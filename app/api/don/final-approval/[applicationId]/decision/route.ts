import type { DonDecision } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { sanitizeText } from "@/lib/security";
import { submitDonDecision } from "@/services/verification/verificationService";
import { handleApiError } from "@/services/monitoring/errorService";

const decisions = ["approved_for_hire", "not_approved", "returned_for_correction"];

export async function POST(request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  const user = await requireRole(["super_admin_hr", "don_approver"]);
  const { applicationId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const decisionValue = sanitizeText(body.decision, 80);
    if (!decisions.includes(decisionValue)) {
      return NextResponse.json({ error: "Choose a valid DON decision." }, { status: 400 });
    }
    const checklist = await submitDonDecision({
      applicationId,
      userId: user.id,
      decision: decisionValue as DonDecision,
      comment: sanitizeText(body.comment, 4000)
    });
    return NextResponse.json({ checklist });
  } catch (error) {
    return handleApiError(error, {
      scope: "don.decision",
      action: "don_decision_failed",
      userId: user.id,
      entityType: "application",
      entityId: applicationId,
      fallbackMessage: error instanceof Error ? error.message : "DON decision could not be submitted."
    });
  }
}
