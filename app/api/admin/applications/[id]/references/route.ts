import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

// HR adds a reference record on behalf of the applicant. Only `name` is
// required. relationship, phone, email, employer are optional.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(["super_admin_hr", "hr"]);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });

    const name = sanitizeText(body.name, 200);
    if (!name) throw new AppError("Reference name is required.", { statusCode: 400, code: "VALIDATION" });

    const record = await prisma.reference.create({
      data: {
        applicantProfileId: application.applicantProfileId,
        applicationId: application.id,
        name,
        relationship: sanitizeText(body.relationship, 200) || null,
        phone: sanitizeText(body.phone, 50) || null,
        email: sanitizeText(body.email, 200) || null,
        employer: sanitizeText(body.employer, 200) || null
      }
    });
    await logAction(actor.id, "admin.reference_added", "reference", record.id, {
      applicationId: id,
      name
    } as Prisma.InputJsonValue);
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.references",
      action: "create",
      entityType: "reference",
      fallbackMessage: "Could not save reference."
    });
  }
}
