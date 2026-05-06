import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { runExcelCredentialMonitor } from "@/services/excel/excelCredentialMonitorService";
import { handleApiError } from "@/services/monitoring/errorService";

export async function POST(request: Request) {
  const user = await requireRole(["admin", "super_admin_hr"]);
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runExcelCredentialMonitor({ force: Boolean(body.force) });
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
