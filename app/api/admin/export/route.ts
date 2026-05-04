import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  exportApplicationsCsv,
  exportAuditLogsCsv,
  exportLicenseStatusCsv,
  exportOnboardingStatusCsv
} from "@/services/export/exportService";
import { handleApiError } from "@/services/monitoring/errorService";

export async function GET(request: Request) {
  const user = await requireRole(["admin"]);

  try {
    const url = new URL(request.url);
    const type = (url.searchParams.get("type") ?? "applications").trim();
    const exporterMap = {
      applications: exportApplicationsCsv,
      onboarding_status: exportOnboardingStatusCsv,
      license_status: exportLicenseStatusCsv,
      audit_logs: exportAuditLogsCsv
    } as const;

    if (!(type in exporterMap)) {
      return NextResponse.json({ error: "Choose a valid export type." }, { status: 400 });
    }

    const csv = await exporterMap[type as keyof typeof exporterMap]();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=${type}.csv`
      }
    });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.export",
      action: "bulk_action_failed",
      userId: user.id,
      entityType: "admin_export",
      fallbackMessage: "Export could not be generated."
    });
  }
}
