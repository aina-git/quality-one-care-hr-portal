import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security";
import { withApi, AppError } from "@/services/monitoring/errorService";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";
import { ensureFinalVerificationChecklist } from "@/services/verification/verificationService";

/**
 * The simple traffic-light HR outcome endpoint.
 *
 *   PASS  (green)  → application status: approved      (proceeds to verification or onboarding)
 *   AMBER (amber)  → application status: ready_for_don_review (sends to DON for second look)
 *   FAIL  (red)    → application status: rejected      (HR-level fail; case ends here)
 *
 * Each outcome is paired with a required HR note that is stored in the audit trail
 * and surfaced in the DON dashboard / applicant message.
 */

const OUTCOMES = ["pass", "amber", "fail"] as const;
type Outcome = (typeof OUTCOMES)[number];

// All three outcomes show up on the DON dashboard color-coded.
// Green/amber/red are derived from status via the outcomeColor helper.
const STATUS_BY_OUTCOME: Record<Outcome, "verification_passed" | "ready_for_don_review" | "rejected"> = {
  pass: "verification_passed",
  amber: "ready_for_don_review",
  fail: "rejected"
};

const ACTION_BY_OUTCOME: Record<Outcome, string> = {
  pass: "hr_pass",
  amber: "hr_send_to_don",
  fail: "hr_fail"
};

export const POST = withApi(
  { scope: "hr.outcome", entityType: "application", fallbackMessage: "Could not record outcome." },
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireRole(["hr", "admin", "super_admin_hr"]);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const outcome = sanitizeText(body.outcome, 20) as Outcome;
    const note = sanitizeText(body.note, 4000);

    if (!OUTCOMES.includes(outcome)) {
      throw new AppError("Choose pass, amber, or fail.", { statusCode: 400, code: "VALIDATION" });
    }
    if (!note) {
      throw new AppError("A note is required to record an outcome.", { statusCode: 400, code: "VALIDATION" });
    }

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) {
      throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });
    }

    const targetStatus = STATUS_BY_OUTCOME[outcome];

    // For PASS that goes to verification, ensure checklist exists
    if (outcome === "pass") {
      await ensureFinalVerificationChecklist(id, user.id);
    }

    const updated = await updateApplicationLifecycle({
      applicationId: id,
      userId: user.id,
      action: ACTION_BY_OUTCOME[outcome],
      patch: {
        status: targetStatus,
        ...(outcome === "fail" ? { rejectedAt: new Date() } : {}),
        ...(outcome === "amber" ? { submittedToDonAt: new Date() } : {}),
        ...(outcome === "pass" ? { verificationStartedAt: new Date() } : {})
      },
      details: { note, outcome }
    });

    await logAction(user.id, `hr_outcome_${outcome}`, "application", id, { note, outcome });

    return NextResponse.json({ ok: true, application: updated, outcome });
  }
);
