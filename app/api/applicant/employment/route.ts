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

    const employerName = sanitizeText(body.employerName, 200);
    const roleTitle = sanitizeText(body.roleTitle, 200);
    if (!employerName || !roleTitle) {
      throw new AppError("Employer name and role title are required.", { statusCode: 400, code: "VALIDATION" });
    }

    const record = await prisma.employmentHistory.create({
      data: {
        applicantProfileId: application.applicantProfileId,
        applicationId: application.id,
        employerName,
        roleTitle,
        supervisorName: sanitizeText(body.supervisorName, 200) || null,
        supervisorPhone: sanitizeText(body.supervisorPhone, 50) || null,
        duties: sanitizeText(body.duties, 2000) || null,
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
        pediatricCare: Boolean(body.pediatricCare)
      }
    });

    await logAction(user.id, "applicant.employment_added", "employmentHistory", record.id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, record, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.employment",
      action: "create",
      entityType: "employmentHistory",
      fallbackMessage: "Could not save employment record."
    });
  }
}
