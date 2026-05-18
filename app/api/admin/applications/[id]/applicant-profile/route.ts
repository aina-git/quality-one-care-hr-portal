import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

// HR-side update of an applicant's profile-level fields, looked up by the
// application id (so HR doesn't need to know the profile id). Fills the gap
// where OCR extracted text but didn't land it cleanly into structured fields,
// or where the applicant skipped a section. Audit-logged with the actor's id.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(["super_admin_hr", "hr"]);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const application = await prisma.application.findUnique({
      where: { id },
      include: { applicantProfile: true }
    });
    if (!application) {
      throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });
    }

    const data: Prisma.ApplicantProfileUpdateInput = {};
    function maybeText(key: keyof Prisma.ApplicantProfileUpdateInput, raw: unknown, max: number) {
      if (raw === undefined) return;
      const value = sanitizeText(raw, max);
      (data as Record<string, unknown>)[key as string] = value || null;
    }

    maybeText("phone", body.phone, 50);
    maybeText("address", body.address, 240);
    maybeText("city", body.city, 120);
    maybeText("state", body.state, 60);
    maybeText("zip", body.zip, 30);
    maybeText("pediatricExperience", body.pediatricExperience, 4000);

    if (body.dateOfBirth !== undefined) {
      if (body.dateOfBirth === null || body.dateOfBirth === "") {
        data.dateOfBirth = null;
      } else {
        const d = new Date(String(body.dateOfBirth));
        if (Number.isNaN(d.getTime())) {
          throw new AppError("Invalid date of birth.", { statusCode: 400, code: "VALIDATION" });
        }
        data.dateOfBirth = d;
      }
    }

    if (Object.keys(data).length === 0) {
      throw new AppError("Nothing to update.", { statusCode: 400, code: "VALIDATION" });
    }

    const updated = await prisma.applicantProfile.update({
      where: { id: application.applicantProfileId },
      data
    });
    await logAction(
      actor.id,
      "admin.applicant_profile_updated",
      "applicant_profile",
      application.applicantProfileId,
      { applicationId: id, fields: Object.keys(data) } as Prisma.InputJsonValue
    );
    return NextResponse.json({ ok: true, profile: updated });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.applicant-profile",
      action: "update",
      entityType: "applicant_profile",
      fallbackMessage: "Could not update applicant profile."
    });
  }
}
