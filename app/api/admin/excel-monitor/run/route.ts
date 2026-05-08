import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { runExcelCredentialMonitor } from "@/services/excel/excelCredentialMonitorService";
import { handleApiError } from "@/services/monitoring/errorService";

export async function POST(request: Request) {
  const user = await requireRole(["admin", "super_admin_hr"]);
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body.force);
    const result = await runExcelCredentialMonitor({ force });
    await logAction(user.id, "excel_monitor_run", "excel_monitor", null, {
      force,
      scanned: result.scanned,
      sent: result.sent,
      skipped: result.skipped
    });
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.excelMonitor",
      action: "excel_monitor_run_failed",
      userId: user.id,
      entityType: "excel_monitor",
      fallbackMessage: "Excel monitor could not read the workbook."
    });
  }
}
