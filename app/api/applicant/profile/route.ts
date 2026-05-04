import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { sanitizeText } from "@/lib/security";
import { handleApiError } from "@/services/monitoring/errorService";

function parseDate(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function maybeString(value: unknown, max: number) {
  if (value === undefined) return undefined;
  const cleaned = sanitizeText(value, max);
  return cleaned || null;
}

export async function PATCH(request: Request) {
  try {
    const user = await requireRole(["applicant"]);
    const body = await request.json().catch(() => ({}));
    const { application } = await getOrCreateApplicantApplication(user.id);

    const name = body.name !== undefined ? sanitizeText(body.name, 200) : undefined;
    const profileData = {
      phone: maybeString(body.phone, 50),
      address: maybeString(body.address, 300),
      city: maybeString(body.city, 100),
      state: maybeString(body.state, 100),
      zip: maybeString(body.zip, 20),
      pediatricExperience: maybeString(body.pediatricExperience, 4000),
      dateOfBirth: parseDate(body.dateOfBirth)
    };

    if (name !== undefined && name) {
      await prisma.user.update({ where: { id: user.id }, data: { name } });
    }
    await prisma.applicantProfile.update({
      where: { id: application.applicantProfileId },
      data: Object.fromEntries(Object.entries(profileData).filter(([, v]) => v !== undefined))
    });

    await logAction(user.id, "applicant.profile_updated", "applicantProfile", application.applicantProfileId, {
      fields: Object.keys(profileData).filter((k) => profileData[k as keyof typeof profileData] !== undefined)
    });
    const validation = await validateApplication(application.id, user.id);
    return NextResponse.json({ ok: true, completionPercentage: validation.completionPercentage });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.profile",
      action: "patch",
      entityType: "applicantProfile",
      fallbackMessage: "Could not update profile."
    });
  }
}
