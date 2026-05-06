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

// HR adds a license record on behalf of the applicant. Only `type` is
// required. licenseNumber, issuingState, issueDate, expiresAt are optional.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(["admin", "super_admin_hr", "hr"]);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });

    const type = sanitizeText(body.type, 100);
    if (!type) throw new AppError("License type is required.", { statusCode: 400, code: "VALIDATION" });

    const record = await prisma.license.create({
      data: {
        applicantProfileId: application.applicantProfileId,
        applicationId: application.id,
        type,
        licenseNumber: sanitizeText(body.licenseNumber, 100) || null,
        issuingState: sanitizeText(body.issuingState, 60) || null,
        issueDate: parseDate(body.issueDate),
        expiresAt: parseDate(body.expiresAt)
      }
    });
    await logAction(actor.id, "admin.license_added", "license", record.id, {
      applicationId: id,
      type
    } as Prisma.InputJsonValue);
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.licenses",
      action: "create",
      entityType: "license",
      fallbackMessage: "Could not save license."
    });
  }
}
