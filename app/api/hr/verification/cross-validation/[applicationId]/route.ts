import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { withApi } from "@/services/monitoring/errorService";
import { runCrossValidation } from "@/services/verification/crossValidationService";

export const POST = withApi(
  { scope: "hr.verification.crossValidation", entityType: "application", fallbackMessage: "Cross-validation failed." },
  async (_request: Request, { params }: { params: Promise<{ applicationId: string }> }) => {
    const user = await requireRole(["hr", "admin", "super_admin_hr", "don_approver", "executive_view_only"]);
    const { applicationId } = await params;
    const report = await runCrossValidation(applicationId);
    await logAction(user.id, "cross_validation_run", "application", applicationId, {
      totalChecks: report.totalChecks,
      criticalCount: report.criticalCount,
      warningCount: report.warningCount,
      consistencyScore: report.consistencyScore
    });
    return NextResponse.json({ ok: true, report });
  }
);
