import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { readCredentialAlerts } from "@/services/excel/excelCredentialMonitorService";
import { handleApiError } from "@/services/monitoring/errorService";

export async function GET() {
  const user = await requireRole(["super_admin_hr"]);
  try {
    const result = await readCredentialAlerts();
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.excelMonitor",
      action: "excel_monitor_preview_failed",
      userId: user.id,
      entityType: "excel_monitor",
      fallbackMessage: "Excel monitor preview could not read the workbook."
    });
  }
}
