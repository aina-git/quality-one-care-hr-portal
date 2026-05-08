import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { queueOrSendEmail } from "@/services/notifications/emailService";

export type ExcelCredentialMonitorSettings = {
  enabled: boolean;
  worksheetName?: string;
  hrCopyEmails: string[];
  subjectPrefix: string;
  fileName: string | null;
  fileSize: number | null;
  fileUploadedAt: string | null;
  hasFile: boolean;
};

type CredentialRow = {
  nurseName: string;
  email: string;
  smsEmail: string;
  documentName: string;
  expiresAt: Date;
  sourceRow: number;
};

export type CredentialAlert = CredentialRow & {
  daysUntilExpiration: number;
  bucket: AlertBucket;
  frequencyLabel: string;
  dueNow: boolean;
};

type AlertBucket = "expired" | "lt15" | "lt30" | "lt60" | "lt90";

const CONFIG_ID = "default";

const defaultSettings: ExcelCredentialMonitorSettings = {
  enabled: false,
  worksheetName: "",
  hrCopyEmails: [],
  subjectPrefix: "Credential expiration notice",
  fileName: null,
  fileSize: null,
  fileUploadedAt: null,
  hasFile: false
};

const bucketRules: Record<AlertBucket, { label: string; maxPerWindow: number; windowDays: number }> = {
  expired: { label: "Expired - three times per day", maxPerWindow: 3, windowDays: 1 },
  lt15: { label: "Less than 15 days - twice per day", maxPerWindow: 2, windowDays: 1 },
  lt30: { label: "Less than 30 days - once per day", maxPerWindow: 1, windowDays: 1 },
  lt60: { label: "Less than 60 days - twice per week", maxPerWindow: 2, windowDays: 7 },
  lt90: { label: "Less than 90 days - three times per month", maxPerWindow: 3, windowDays: 30 }
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pick(row: Record<string, unknown>, aliases: string[]) {
  const wanted = new Set(aliases.map(normalizeHeader));
  const key = Object.keys(row).find((candidate) => wanted.has(normalizeHeader(candidate)));
  return key ? String(row[key] ?? "").trim() : "";
}

function pickRaw(row: Record<string, unknown>, aliases: string[]) {
  const wanted = new Set(aliases.map(normalizeHeader));
  const key = Object.keys(row).find((candidate) => wanted.has(normalizeHeader(candidate)));
  return key ? row[key] : "";
}

function parseDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function bucketFor(daysUntilExpiration: number): AlertBucket | null {
  if (daysUntilExpiration < 0) return "expired";
  if (daysUntilExpiration < 15) return "lt15";
  if (daysUntilExpiration < 30) return "lt30";
  if (daysUntilExpiration < 60) return "lt60";
  if (daysUntilExpiration < 90) return "lt90";
  return null;
}

function alertKey(alert: CredentialAlert) {
  return [alert.nurseName, alert.documentName, dateKey(alert.expiresAt), alert.bucket]
    .map((part) => part.toLowerCase())
    .join("|");
}

async function getOrCreateConfig() {
  const existing = await prisma.excelCredentialMonitorConfig.findUnique({ where: { id: CONFIG_ID } });
  if (existing) return existing;
  return prisma.excelCredentialMonitorConfig.create({
    data: {
      id: CONFIG_ID,
      enabled: false,
      hrCopyEmails: [],
      subjectPrefix: defaultSettings.subjectPrefix
    }
  });
}

function toSettings(record: {
  enabled: boolean;
  worksheetName: string | null;
  hrCopyEmails: string[];
  subjectPrefix: string;
  fileName: string | null;
  fileSize: number | null;
  fileUploadedAt: Date | null;
  fileBytes: Buffer | Uint8Array | null;
}): ExcelCredentialMonitorSettings {
  return {
    enabled: record.enabled,
    worksheetName: record.worksheetName ?? "",
    hrCopyEmails: record.hrCopyEmails,
    subjectPrefix: record.subjectPrefix,
    fileName: record.fileName,
    fileSize: record.fileSize,
    fileUploadedAt: record.fileUploadedAt ? record.fileUploadedAt.toISOString() : null,
    hasFile: Boolean(record.fileBytes && record.fileSize && record.fileSize > 0)
  };
}

export async function getExcelCredentialMonitorSettings(): Promise<ExcelCredentialMonitorSettings> {
  const record = await getOrCreateConfig();
  return toSettings(record);
}

export async function saveExcelCredentialMonitorSettings(input: {
  enabled: boolean;
  worksheetName?: string;
  hrCopyEmails: string[];
  subjectPrefix: string;
}): Promise<ExcelCredentialMonitorSettings> {
  await getOrCreateConfig();
  const updated = await prisma.excelCredentialMonitorConfig.update({
    where: { id: CONFIG_ID },
    data: {
      enabled: Boolean(input.enabled),
      worksheetName: input.worksheetName?.trim() || null,
      hrCopyEmails: input.hrCopyEmails.map((email) => email.trim()).filter(Boolean),
      subjectPrefix: input.subjectPrefix.trim() || defaultSettings.subjectPrefix
    }
  });
  return toSettings(updated);
}

export async function saveUploadedWorkbook(input: { fileName: string; fileSize: number; buffer: Buffer }) {
  await getOrCreateConfig();
  const bytes = new Uint8Array(input.buffer.byteLength);
  bytes.set(input.buffer);
  const updated = await prisma.excelCredentialMonitorConfig.update({
    where: { id: CONFIG_ID },
    data: {
      fileName: input.fileName,
      fileSize: input.fileSize,
      fileBytes: bytes,
      fileUploadedAt: new Date()
    }
  });
  return toSettings(updated);
}

export async function clearUploadedWorkbook() {
  await getOrCreateConfig();
  const updated = await prisma.excelCredentialMonitorConfig.update({
    where: { id: CONFIG_ID },
    data: {
      fileName: null,
      fileSize: null,
      fileBytes: null,
      fileUploadedAt: null
    }
  });
  return toSettings(updated);
}

async function shouldSend(alert: CredentialAlert, now: Date) {
  const rule = bucketRules[alert.bucket];
  const cutoff = new Date(now.getTime() - rule.windowDays * 24 * 60 * 60 * 1000);
  const recent = await prisma.excelCredentialMonitorSendLog.count({
    where: {
      alertKey: alertKey(alert),
      sentAt: { gte: cutoff }
    }
  });
  return recent < rule.maxPerWindow;
}

export async function readCredentialAlerts(now = new Date()) {
  const record = await getOrCreateConfig();
  const settings = toSettings(record);
  const warnings: string[] = [];

  if (!record.fileBytes || !record.fileSize) {
    warnings.push("No Excel workbook uploaded yet.");
    return { settings, rows: [] as CredentialAlert[], warnings };
  }

  const buffer = Buffer.isBuffer(record.fileBytes) ? record.fileBytes : Buffer.from(record.fileBytes);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = settings.worksheetName && workbook.SheetNames.includes(settings.worksheetName)
    ? settings.worksheetName
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    warnings.push(`Worksheet "${sheetName}" not found in the uploaded workbook.`);
    return { settings, rows: [] as CredentialAlert[], warnings };
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
  const today = startOfDay(now);

  const rows = rawRows.flatMap((row, index) => {
    const firstName = pick(row, ["first name", "firstname"]);
    const lastName = pick(row, ["last name", "lastname"]);
    const nurseName = pick(row, ["nurse name", "nurse", "employee name", "name", "full name"]) || [firstName, lastName].filter(Boolean).join(" ");
    const email = pick(row, ["email", "email address", "nurse email", "employee email"]);
    const smsEmail = pick(row, ["sms email", "email to sms", "sms gateway", "sms gateway email", "text email"]);
    const documentName = pick(row, ["document", "document name", "document type", "license", "license type", "credential", "credential type"]) || "Credential";
    const expiresAt = parseDate(pickRaw(row, ["expiration date", "expires at", "expires", "expiry date", "expiry", "expiration"]));

    if (!nurseName || !expiresAt) {
      if (Object.values(row).some(Boolean)) warnings.push(`Skipped row ${index + 2}: missing nurse name or expiration date.`);
      return [];
    }

    const daysUntilExpiration = Math.floor((startOfDay(expiresAt).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const bucket = bucketFor(daysUntilExpiration);
    if (!bucket) return [];

    return [{
      nurseName,
      email,
      smsEmail,
      documentName,
      expiresAt,
      sourceRow: index + 2,
      daysUntilExpiration,
      bucket,
      frequencyLabel: bucketRules[bucket].label,
      dueNow: false
    }];
  });

  const alerts: CredentialAlert[] = [];
  for (const row of rows) {
    alerts.push({ ...row, dueNow: await shouldSend(row, now) });
  }
  return { settings, rows: alerts, warnings };
}

function buildMessage(alert: CredentialAlert) {
  const expiry = dateKey(alert.expiresAt);
  const status = alert.bucket === "expired"
    ? `expired on ${expiry}`
    : `will expire in ${alert.daysUntilExpiration} day${alert.daysUntilExpiration === 1 ? "" : "s"} on ${expiry}`;
  return [
    `Hello ${alert.nurseName},`,
    "",
    `Our records show that your ${alert.documentName} ${status}.`,
    "Please send the updated document to HR as soon as possible.",
    "",
    "Quality One Care HR"
  ].join("\n");
}

export async function runExcelCredentialMonitor({ force = false }: { force?: boolean } = {}) {
  const now = new Date();
  const { settings, rows, warnings } = await readCredentialAlerts(now);
  if (!settings.enabled && !force) {
    return { scanned: rows.length, sent: 0, skipped: rows.length, warnings: ["Excel monitor is disabled.", ...warnings] };
  }
  if (!settings.hasFile) {
    return { scanned: 0, sent: 0, skipped: 0, warnings };
  }

  let sent = 0;
  let skipped = 0;

  for (const alert of rows) {
    if (!force && !(await shouldSend(alert, now))) {
      skipped += 1;
      continue;
    }

    const recipients = [...new Set([alert.email, alert.smsEmail, ...settings.hrCopyEmails].filter(Boolean))];
    if (!recipients.length) {
      warnings.push(`Skipped ${alert.nurseName} row ${alert.sourceRow}: no email or email-to-SMS address.`);
      skipped += 1;
      continue;
    }

    const subject = `${settings.subjectPrefix}: ${alert.nurseName} - ${alert.documentName}`;
    const body = buildMessage(alert);
    for (const toEmail of recipients) {
      await queueOrSendEmail({ toEmail, subject, body });
      sent += 1;
    }
    await prisma.excelCredentialMonitorSendLog.create({
      data: { alertKey: alertKey(alert) }
    });
  }

  return { scanned: rows.length, sent, skipped, warnings };
}
