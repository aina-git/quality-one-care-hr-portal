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
  const record = await prisma.license.findUnique({ where: { id: recordId } });
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

    const type = sanitizeText(body.type, 100);
    if (!type) {
      throw new AppError("License type is required.", { statusCode: 400, code: "VALIDATION" });
    }

    const updated = await prisma.license.update({
      where: { id },
      data: {
        type,
        licenseNumber: sanitizeText(body.licenseNumber, 100) || null,
        issuingState: sanitizeText(body.issuingState, 100) || null,
        issueDate: parseDate(body.issueDate),
        expiresAt: parseDate(body.expiresAt)
      }
    });

    await logAction(user.id, "applicant.license_updated", "license", id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, record: updated, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.licenses",
      action: "update",
      entityType: "license",
      fallbackMessage: "Could not update license."
    });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["applicant"]);
    const { id } = await params;
    const { application } = await loadOwned(user.id, id);
    await prisma.license.delete({ where: { id } });
    await logAction(user.id, "applicant.license_removed", "license", id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.licenses",
      action: "delete",
      entityType: "license",
      fallbackMessage: "Could not delete license."
    });
  }
}
