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

// HR adds a certification record on behalf of the applicant. Only `name` is
// required. issuer, issueDate, expiresAt are optional.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(["super_admin_hr", "hr"]);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });

    const name = sanitizeText(body.name, 200);
    if (!name) throw new AppError("Certification name is required.", { statusCode: 400, code: "VALIDATION" });

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
    await logAction(actor.id, "admin.certification_added", "certification", record.id, {
      applicationId: id,
      name
    } as Prisma.InputJsonValue);
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.certifications",
      action: "create",
      entityType: "certification",
      fallbackMessage: "Could not save certification."
    });
  }
}
