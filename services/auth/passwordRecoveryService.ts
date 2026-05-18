import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeEmail, sanitizeText } from "@/lib/security";
import { queueOrSendEmail } from "@/services/notifications/emailService";

const recoveryWindowMs = 10 * 60 * 1000;
const rateWindowMs = 15 * 60 * 1000;
const maxIdentifierRequests = 5;
const maxIpRequests = 20;
const maxCodeAttempts = 5;
const genericMessage = "If the information matches our records, recovery instructions will be sent.";

type RequestInput = {
  accountType: "applicant" | "staff";
  contactMethod: "email" | "phone";
  identifier: string;
  verificationDate?: string;
  channel: "email" | "sms";
  ipAddress?: string | null;
  userAgent?: string | null;
};

type VerifyInput = {
  identifier: string;
  code: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type ResetInput = {
  resetToken: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function normalizePhone(value: string) {
  const digits = sanitizeText(value, 40).replace(/\D/g, "");
  return digits.length > 10 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function normalizeDateOnly(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function hashValue(value: string) {
  return crypto
    .createHmac("sha256", process.env.AUTH_SECRET ?? "development-only-change-me")
    .update(value)
    .digest("hex");
}

function maskIdentifier(value: string, method: "email" | "phone") {
  if (method === "email") {
    const [name, domain] = value.split("@");
    return `${name?.slice(0, 2) ?? ""}***@${domain ?? "unknown"}`;
  }
  const phone = normalizePhone(value);
  return phone ? `***${phone.slice(-4)}` : "***";
}

function makeCode() {
  return String(crypto.randomInt(100000, 999999));
}

function makeResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

async function createSmsQueue(toPhone: string, body: string) {
  return prisma.smsQueue.create({
    data: {
      toPhone,
      body,
      provider: process.env.SMS_PROVIDER || null,
      status: "queued",
      attempts: 0,
      errorMessage: process.env.SMS_PROVIDER && process.env.SMS_API_KEY ? null : "SMS provider not configured. Message queued for future delivery."
    }
  });
}

async function rateLimit(identifierHash: string, ipAddress?: string | null) {
  const since = new Date(Date.now() - rateWindowMs);
  const [identifierCount, ipCount] = await Promise.all([
    prisma.passwordRecoveryToken.count({ where: { identifierHash, createdAt: { gte: since } } }),
    ipAddress ? prisma.passwordRecoveryToken.count({ where: { requestIp: ipAddress, createdAt: { gte: since } } }) : Promise.resolve(0)
  ]);
  return identifierCount >= maxIdentifierRequests || ipCount >= maxIpRequests;
}

async function findApplicant(input: RequestInput) {
  const identifier = input.contactMethod === "email" ? sanitizeEmail(input.identifier) : normalizePhone(input.identifier);
  const user = await prisma.user.findFirst({
    where:
      input.contactMethod === "email"
        ? { email: identifier, role: "applicant", isActive: true }
        : { role: "applicant", isActive: true, applicant: { phone: { contains: identifier.slice(-7) } } },
    include: { applicant: { include: { applications: { orderBy: { applicationCreatedAt: "desc" }, take: 1 } } } }
  });
  if (!user?.applicant) return null;
  if (input.contactMethod === "phone" && normalizePhone(user.applicant.phone ?? "") !== identifier) return null;

  const providedDate = normalizeDateOnly(input.verificationDate);
  const applicationDate = normalizeDateOnly(user.applicant.applications[0]?.applicationCreatedAt);
  const birthDate = normalizeDateOnly(user.applicant.dateOfBirth);
  if (!providedDate || (providedDate !== applicationDate && providedDate !== birthDate)) return null;
  return user;
}

async function findStaff(input: RequestInput) {
  if (input.contactMethod !== "email") return null;
  const email = sanitizeEmail(input.identifier);
  return prisma.user.findFirst({
    where: {
      email,
      role: { in: ["hr", "super_admin_hr", "don_approver", "scheduler_limited"] },
      isActive: true
    },
    include: { applicant: true }
  });
}

export async function requestPasswordRecovery(input: RequestInput) {
  const identifier = input.contactMethod === "email" ? sanitizeEmail(input.identifier) : normalizePhone(input.identifier);
  const identifierHash = hashValue(`${input.contactMethod}:${identifier}`);
  const details = {
    accountType: input.accountType,
    contactMethod: input.contactMethod,
    maskedIdentifier: maskIdentifier(identifier, input.contactMethod),
    channel: input.channel,
    role: input.accountType === "staff" ? "staff" : "applicant"
  };

  if (await rateLimit(identifierHash, input.ipAddress)) {
    await logAction(null, "password_recovery_rate_limited", "password_recovery", null, details);
    return { message: genericMessage, sent: false, rateLimited: true };
  }

  await logAction(null, "password_recovery_requested", "password_recovery", null, details);

  const user = input.accountType === "applicant" ? await findApplicant(input) : await findStaff(input);
  const approvalRequired = input.accountType === "staff" && input.contactMethod === "phone";
  if (!user || approvalRequired) {
    await prisma.passwordRecoveryToken.create({
      data: {
        userId: user?.id ?? null,
        role: user?.role,
        channel: input.channel as MessageChannel,
        identifierHash,
        codeHash: hashValue(`unmatched:${makeCode()}`),
        expiresAt: new Date(Date.now() + recoveryWindowMs),
        requestIp: input.ipAddress ?? null,
        requestUserAgent: input.userAgent ?? null,
        approvalRequired
      }
    });
    await logAction(user?.id ?? null, "password_recovery_failed", "password_recovery", user?.id ?? null, {
      ...details,
      reason: approvalRequired ? "staff_phone_recovery_requires_admin_approval" : "no_match"
    });
    return { message: genericMessage, sent: false, rateLimited: false };
  }

  const code = makeCode();
  await prisma.passwordRecoveryToken.updateMany({
    where: { userId: user.id, usedAt: null, verifiedAt: null },
    data: { usedAt: new Date() }
  });
  const token = await prisma.passwordRecoveryToken.create({
    data: {
      userId: user.id,
      role: user.role,
      channel: input.channel as MessageChannel,
      identifierHash,
      codeHash: hashValue(code),
      expiresAt: new Date(Date.now() + recoveryWindowMs),
      requestIp: input.ipAddress ?? null,
      requestUserAgent: input.userAgent ?? null
    }
  });

  const body = `Your Quality One Care password recovery code is ${code}. This code expires in 10 minutes. If you did not request this, contact Quality One Care HR.`;
  if (input.channel === "email") {
    await queueOrSendEmail({
      toEmail: user.email,
      subject: "Quality One Care password recovery code",
      body,
      userId: user.id
    });
  } else {
    const phone = user.applicant?.phone ? normalizePhone(user.applicant.phone) : normalizePhone(input.identifier);
    await createSmsQueue(phone, body);
  }

  await logAction(user.id, "password_recovery_code_sent", "password_recovery", token.id, {
    ...details,
    providerConfigured: input.channel === "email" ? Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_API_KEY) : Boolean(process.env.SMS_PROVIDER && process.env.SMS_API_KEY)
  });
  return { message: genericMessage, sent: true, rateLimited: false };
}

export async function verifyRecoveryCode(input: VerifyInput) {
  const rawIdentifier = sanitizeText(input.identifier, 320);
  const emailHash = hashValue(`email:${sanitizeEmail(rawIdentifier)}`);
  const phoneHash = hashValue(`phone:${normalizePhone(rawIdentifier)}`);
  const codeHash = hashValue(sanitizeText(input.code, 20));
  const token = await prisma.passwordRecoveryToken.findFirst({
    where: {
      identifierHash: { in: [emailHash, phoneHash] },
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!token || token.attempts >= maxCodeAttempts || token.codeHash !== codeHash) {
    if (token) {
      await prisma.passwordRecoveryToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    }
    await logAction(token?.userId ?? null, "password_recovery_failed", "password_recovery", token?.id ?? null, {
      reason: token?.attempts && token.attempts >= maxCodeAttempts ? "too_many_code_attempts" : "invalid_or_expired_code"
    });
    return { ok: false, resetToken: null };
  }

  const resetToken = makeResetToken();
  await prisma.passwordRecoveryToken.update({
    where: { id: token.id },
    data: {
      verifiedAt: new Date(),
      resetTokenHash: hashValue(resetToken),
      attempts: { increment: 1 },
      requestIp: input.ipAddress ?? token.requestIp,
      requestUserAgent: input.userAgent ?? token.requestUserAgent
    }
  });
  await logAction(token.userId ?? null, "password_recovery_verified", "password_recovery", token.id);
  return { ok: true, resetToken };
}

export async function resetPasswordWithToken(input: ResetInput) {
  const password = sanitizeText(input.password, 256);
  if (password.length < 8) return { ok: false };
  const token = await prisma.passwordRecoveryToken.findFirst({
    where: {
      resetTokenHash: hashValue(sanitizeText(input.resetToken, 200)),
      verifiedAt: { not: null },
      usedAt: null,
      expiresAt: { gt: new Date() },
      userId: { not: null }
    }
  });
  if (!token?.userId) {
    await logAction(null, "password_recovery_failed", "password_recovery", null, { reason: "invalid_reset_token" });
    return { ok: false };
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: token.userId }, data: { passwordHash } }),
    prisma.passwordRecoveryToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.passwordRecoveryToken.updateMany({
      where: { userId: token.userId, id: { not: token.id }, usedAt: null },
      data: { usedAt: new Date() }
    })
  ]);
  await logAction(token.userId, "password_reset_completed", "password_recovery", token.id);
  return { ok: true };
}

export function recoveryGenericMessage() {
  return genericMessage;
}
