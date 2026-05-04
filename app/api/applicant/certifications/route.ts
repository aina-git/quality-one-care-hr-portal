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

    const name = sanitizeText(body.name, 200);
    if (!name) {
      throw new AppError("Certification name is required.", { statusCode: 400, code: "VALIDATION" });
    }

    const record = await prisma.certification.create({
      data: {
        applicantProfileId: application.applicantProfileId,
        applicationId: application.id,
        name,
        issuer: sanitizeText(body.issuer, 200) || null,
        issueDate: parseDate(body.issueDate),
        expiresAt: parseDate(body.expiresAt)
      }
    });

    await logAction(user.id, "applicant.certification_added", "certification", record.id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, record, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.certifications",
      action: "create",
      entityType: "certification",
      fallbackMessage: "Could not save certification."
    });
  }
}
