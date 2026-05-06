import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getExcelCredentialMonitorSettings,
  saveExcelCredentialMonitorSettings
} from "@/services/excel/excelCredentialMonitorService";
import { handleApiError } from "@/services/monitoring/errorService";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = [".xlsx", ".xlsm", ".xls"];
const uploadDir = path.join(process.cwd(), "storage", "excel-monitor");
const uploadFilename = "nurses.xlsx";

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

    await fs.mkdir(uploadDir, { recursive: true });
    const target = path.join(uploadDir, uploadFilename);
    const buffer = Buffer.from(await entry.arrayBuffer());
    await fs.writeFile(target, buffer);

    const current = await getExcelCredentialMonitorSettings();
    const settings = await saveExcelCredentialMonitorSettings({
      ...current,
      excelPath: target
    });

    return NextResponse.json({
      ok: true,
      path: target,
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
