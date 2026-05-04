import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { sanitizeText, sanitizeEmail } from "@/lib/security";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

export async function POST(request: Request) {
  try {
    const user = await requireRole(["applicant"]);
    const body = await request.json().catch(() => ({}));
    const { application } = await getOrCreateApplicantApplication(user.id);

    const name = sanitizeText(body.name, 200);
    if (!name) {
      throw new AppError("Reference name is required.", { statusCode: 400, code: "VALIDATION" });
    }

    const record = await prisma.reference.create({
      data: {
        applicantProfileId: application.applicantProfileId,
        applicationId: application.id,
        name,
        relationship: sanitizeText(body.relationship, 200) || null,
        phone: sanitizeText(body.phone, 50) || null,
        email: sanitizeEmail(body.email) || null,
        employer: sanitizeText(body.employer, 200) || null
      }
    });

    await logAction(user.id, "applicant.reference_added", "reference", record.id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, record, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.references",
      action: "create",
      entityType: "reference",
      fallbackMessage: "Could not save reference."
    });
  }
}
