import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { sanitizeText } from "@/lib/security";
import {
  getExcelCredentialMonitorSettings,
  saveExcelCredentialMonitorSettings
} from "@/services/excel/excelCredentialMonitorService";
import { handleApiError } from "@/services/monitoring/errorService";

function splitEmails(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? "")
    .split(/[\n,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export async function GET() {
  await requireRole(["admin", "super_admin_hr"]);
  return NextResponse.json({ settings: await getExcelCredentialMonitorSettings() });
}

export async function POST(request: Request) {
  const user = await requireRole(["admin", "super_admin_hr"]);
  try {
    const body = await request.json().catch(() => ({}));
    const settings = await saveExcelCredentialMonitorSettings({
      enabled: Boolean(body.enabled),
      worksheetName: sanitizeText(body.worksheetName, 120),
      hrCopyEmails: splitEmails(body.hrCopyEmails),
      subjectPrefix: sanitizeText(body.subjectPrefix, 160)
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.excelMonitor",
      action: "excel_monitor_settings_failed",
      userId: user.id,
      entityType: "excel_monitor",
      fallbackMessage: "Excel monitor settings could not be saved."
    });
  }
}
