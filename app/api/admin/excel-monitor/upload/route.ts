import path from "node:path";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { clearUploadedWorkbook, saveUploadedWorkbook } from "@/services/excel/excelCredentialMonitorService";
import { handleApiError } from "@/services/monitoring/errorService";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = [".xlsx", ".xlsm", ".xls"];

export async function POST(request: Request) {
  const user = await requireRole(["admin", "super_admin_hr"]);
  try {
    const form = await request.formData();
    const entry = form.get("file");
    if (!(entry instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (entry.size === 0) {
      return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
    }
    if (entry.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 25 MB)." }, { status: 400 });
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: "Only .xlsx/.xlsm/.xls files are accepted." }, { status: 400 });
    }

    const buffer = Buffer.from(await entry.arrayBuffer());
    const settings = await saveUploadedWorkbook({
      fileName: entry.name,
      fileSize: entry.size,
      buffer
    });

    return NextResponse.json({
      ok: true,
      bytes: entry.size,
      filename: entry.name,
      settings
    });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.excelMonitor",
      action: "excel_monitor_upload_failed",
      userId: user.id,
      entityType: "excel_monitor",
      fallbackMessage: "Excel upload failed."
    });
  }
}

export async function DELETE() {
  const user = await requireRole(["admin", "super_admin_hr"]);
  try {
    const settings = await clearUploadedWorkbook();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.excelMonitor",
      action: "excel_monitor_clear_failed",
      userId: user.id,
      entityType: "excel_monitor",
      fallbackMessage: "Could not remove uploaded workbook."
    });
  }
}
