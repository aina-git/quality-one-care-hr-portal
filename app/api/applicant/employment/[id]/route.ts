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
  const record = await prisma.employmentHistory.findUnique({ where: { id: recordId } });
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

    const employerName = sanitizeText(body.employerName, 200);
    const roleTitle = sanitizeText(body.roleTitle, 200);
    if (!employerName || !roleTitle) {
      throw new AppError("Employer name and role title are required.", { statusCode: 400, code: "VALIDATION" });
    }

    const updated = await prisma.employmentHistory.update({
      where: { id },
      data: {
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

    await logAction(user.id, "applicant.employment_updated", "employmentHistory", id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, record: updated, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.employment",
      action: "update",
      entityType: "employmentHistory",
      fallbackMessage: "Could not update employment record."
    });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["applicant"]);
    const { id } = await params;
    const { application } = await loadOwned(user.id, id);
    await prisma.employmentHistory.delete({ where: { id } });
    await logAction(user.id, "applicant.employment_removed", "employmentHistory", id, { applicationId: application.id });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.employment",
      action: "delete",
      entityType: "employmentHistory",
      fallbackMessage: "Could not delete employment record."
    });
  }
}
