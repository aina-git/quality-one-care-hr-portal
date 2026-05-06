import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

// PATCH any application — currently exposes only intakeLocationId. Lets HR
// set / change / clear which physical clinic processed an applicant's intake.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(["admin", "super_admin_hr", "hr"]);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) {
      throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });
    }

    const data: Record<string, unknown> = {};
    if (body.intakeLocationId !== undefined) {
      const raw = body.intakeLocationId;
      if (raw === null || raw === "") {
        data.intakeLocationId = null;
      } else {
        const locId = sanitizeText(raw, 64);
        if (!locId) throw new AppError("Invalid intake location.", { statusCode: 400, code: "VALIDATION" });
        const exists = await prisma.intakeLocation.findUnique({ where: { id: locId } });
        if (!exists) throw new AppError("Intake location not found.", { statusCode: 404, code: "NOT_FOUND" });
        data.intakeLocationId = locId;
      }
    }
    if (Object.keys(data).length === 0) {
      throw new AppError("Nothing to update.", { statusCode: 400, code: "VALIDATION" });
    }

    const updated = await prisma.application.update({ where: { id }, data });
    await logAction(actor.id, "admin.application_updated", "application", id, data as Prisma.InputJsonValue);
    return NextResponse.json({ ok: true, application: updated });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.applications",
      action: "update",
      entityType: "application",
      fallbackMessage: "Could not update application."
    });
  }
}

// DELETE — hard-deletes any application. Cascade-deletes all related records
// per the Prisma relations on the Application model. HR-only. Audit logged.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(["admin", "super_admin_hr", "hr"]);
    const { id } = await params;
    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) {
      throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });
    }
    await prisma.application.delete({ where: { id } });
    await logAction(actor.id, "admin.application_deleted", "application", id, {
      deletedStatus: application.status,
      applicantProfileId: application.applicantProfileId
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.applications",
      action: "delete",
      entityType: "application",
      fallbackMessage: "Could not delete application."
    });
  }
}
