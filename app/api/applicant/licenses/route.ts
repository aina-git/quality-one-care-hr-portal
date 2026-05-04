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

export async function POST(request: Request) {
  try {
    const user = await requireRole(["applicant"]);
    const body = await request.json().catch(() => ({}));
    const { application } = await getOrCreateApplicantApplication(user.id);

    const type = sanitizeText(body.type, 100);
    if (!type) {
      throw new AppError("License type is required.", { statusCode: 400, code: "VALIDATION" });
    }

    const record = await prisma.license.create({
      data: {
        applicantProfileId: application.applicantProfileId,
        applicationId: application.id,
        type,
        licenseNumber: sanitizeText(body.licenseNumber, 100) || null,
        issuingState: sanitizeText(body.issuingState, 100) || null,
        issueDate: parseDate(body.issueDate),
        expiresAt: parseDate(body.expiresAt)
      }
    });

    await logAction(user.id, "applicant.license_added", "license", record.id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, record, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.licenses",
      action: "create",
      entityType: "license",
      fallbackMessage: "Could not save license."
    });
  }
}
