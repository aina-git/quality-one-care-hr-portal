import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { sanitizeText } from "@/lib/security";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

function parseDate(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadOwned(userId: string, recordId: string) {
  const { application } = await getOrCreateApplicantApplication(userId);
  const record = await prisma.certification.findUnique({ where: { id: recordId } });
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
      throw new AppError("Certification name is required.", { statusCode: 400, code: "VALIDATION" });
    }

    const updated = await prisma.certification.update({
      where: { id },
      data: {
        name,
        issuer: sanitizeText(body.issuer, 200) || null,
        issueDate: parseDate(body.issueDate),
        expiresAt: parseDate(body.expiresAt)
      }
    });

    await logAction(user.id, "applicant.certification_updated", "certification", id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, record: updated, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.certifications",
      action: "update",
      entityType: "certification",
      fallbackMessage: "Could not update certification."
    });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["applicant"]);
    const { id } = await params;
    const { application } = await loadOwned(user.id, id);
    await prisma.certification.delete({ where: { id } });
    await logAction(user.id, "applicant.certification_removed", "certification", id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.certifications",
      action: "delete",
      entityType: "certification",
      fallbackMessage: "Could not delete certification."
    });
  }
}
