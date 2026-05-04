import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { sanitizeText, sanitizeEmail } from "@/lib/security";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

async function loadOwned(userId: string, recordId: string) {
  const { application } = await getOrCreateApplicantApplication(userId);
  const record = await prisma.reference.findUnique({ where: { id: recordId } });
  if (!record || record.applicantProfileId !== application.applicantProfileId) {
    throw new AppError("Record not found.", { statusCode: 404, code: "NOT_FOUND" });
  }
  return { application, record };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["applicant"]);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { application } = await loadOwned(user.id, id);

    const name = sanitizeText(body.name, 200);
    if (!name) {
      throw new AppError("Reference name is required.", { statusCode: 400, code: "VALIDATION" });
    }

    const updated = await prisma.reference.update({
      where: { id },
      data: {
        name,
        relationship: sanitizeText(body.relationship, 200) || null,
        phone: sanitizeText(body.phone, 50) || null,
        email: sanitizeEmail(body.email) || null,
        employer: sanitizeText(body.employer, 200) || null
      }
    });

    await logAction(user.id, "applicant.reference_updated", "reference", id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, record: updated, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.references",
      action: "update",
      entityType: "reference",
      fallbackMessage: "Could not update reference."
    });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["applicant"]);
    const { id } = await params;
    const { application } = await loadOwned(user.id, id);
    await prisma.reference.delete({ where: { id } });
    await logAction(user.id, "applicant.reference_removed", "reference", id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.references",
      action: "delete",
      entityType: "reference",
      fallbackMessage: "Could not delete reference."
    });
  }
}
