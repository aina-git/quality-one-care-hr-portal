import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { sanitizeText } from "@/lib/security";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

// PATCH the applicant's own application — currently exposes only the intake
// location field. The applicant can set or clear which physical clinic took
// their intake at any time before final submission. We don't allow it to be
// changed once a hiring decision has been made.
export async function PATCH(request: Request) {
  try {
    const user = await requireRole(["applicant"]);
    const body = await request.json().catch(() => ({}));
    const { application } = await getOrCreateApplicantApplication(user.id);

    const data: Record<string, unknown> = {};
    if (body.intakeLocationId !== undefined) {
      const raw = body.intakeLocationId;
      if (raw === null || raw === "") {
        data.intakeLocationId = null;
      } else {
        const id = sanitizeText(raw, 64);
        if (!id) throw new AppError("Invalid intake location.", { statusCode: 400, code: "VALIDATION" });
        const exists = await prisma.intakeLocation.findUnique({ where: { id } });
        if (!exists || !exists.isActive) {
          throw new AppError("Intake location not found.", { statusCode: 404, code: "NOT_FOUND" });
        }
        data.intakeLocationId = id;
      }
    }
    if (Object.keys(data).length === 0) {
      throw new AppError("Nothing to update.", { statusCode: 400, code: "VALIDATION" });
    }

    const updated = await prisma.application.update({ where: { id: application.id }, data });
    await logAction(user.id, "applicant.application_updated", "application", application.id, data as Prisma.InputJsonValue);
    return NextResponse.json({ ok: true, application: updated });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.application",
      action: "update",
      entityType: "application",
      fallbackMessage: "Could not update application."
    });
  }
}

// DELETE the applicant's own application. Hard-deletes the Application row;
// related rows (documents, processing jobs, references, etc.) cascade-delete
// via the relations defined on the Application model. The ApplicantProfile
// itself is left intact so the applicant can submit a fresh application with
// the same email — a brand-new Application row gets created on next visit
// via getOrCreateApplicantApplication.
export async function DELETE() {
  try {
    const user = await requireRole(["applicant"]);
    const { application } = await getOrCreateApplicantApplication(user.id);

    // Drafts and HR-flagged "needs correction" states are always deletable by
    // the owner. Once HR has actively reviewed/decided, deletion would lose
    // important audit data, so we block it. The applicant can still ask HR.
    const lockedStates = new Set([
      "hired", "rejected", "approved", "don_approved", "don_rejected",
      "in_onboarding", "onboarding_complete", "active_employee"
    ]);
    if (lockedStates.has(application.status)) {
      throw new AppError(
        "This application has reached a final stage and can no longer be deleted by you. Please contact HR.",
        { statusCode: 409, code: "LOCKED" }
      );
    }

    await prisma.application.delete({ where: { id: application.id } });
    await logAction(user.id, "applicant.application_deleted", "application", application.id, {
      deletedStatus: application.status
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.application",
      action: "delete",
      entityType: "application",
      fallbackMessage: "Could not delete application."
    });
  }
}
