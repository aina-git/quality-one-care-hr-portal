import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { exportApplicationsCsv } from "@/services/export/exportService";
import { handleApiError } from "@/services/monitoring/errorService";

export async function GET(request: Request) {
  const user = await requireRole(["hr", "admin"]);

  try {
    const url = new URL(request.url);
    const ids = (url.searchParams.get("ids") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const csv = await exportApplicationsCsv(ids.length ? ids : undefined);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=applications-export.csv"
      }
    });
  } catch (error) {
    return handleApiError(error, {
      scope: "hr.export",
      action: "bulk_action_failed",
      userId: user.id,
      entityType: "application_export",
      fallbackMessage: "Application export could not be generated."
    });
  }
}
