import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

// HR adds an employment-history record on behalf of the applicant. Required:
// employerName, roleTitle. Other fields optional. Audit-logged with the actor.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(["admin", "super_admin_hr", "hr"]);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });

    const employerName = sanitizeText(body.employerName, 200);
    const roleTitle = sanitizeText(body.roleTitle, 200);
    if (!employerName || !roleTitle) {
      throw new AppError("Employer and role title are required.", { statusCode: 400, code: "VALIDATION" });
    }

    const record = await prisma.employmentHistory.create({
      data: {
        applicantProfileId: application.applicantProfileId,
        applicationId: application.id,
        employerName,
        roleTitle,
        supervisorName: sanitizeText(body.supervisorName, 200) || null,
        supervisorPhone: sanitizeText(body.supervisorPhone, 50) || null,
        duties: sanitizeText(body.duties, 4000) || null,
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
        pediatricCare: Boolean(body.pediatricCare)
      }
    });
    await logAction(actor.id, "admin.employment_added", "employment_history", record.id, {
      applicationId: id,
      employerName
    } as Prisma.InputJsonValue);
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.employment",
      action: "create",
      entityType: "employment_history",
      fallbackMessage: "Could not save employment record."
    });
  }
}
