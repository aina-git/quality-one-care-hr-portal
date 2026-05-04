import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { handleApiError } from "@/services/monitoring/errorService";

export async function GET() {
  const user = await requireRole(["applicant"]);
  try {
    const { application } = await getOrCreateApplicantApplication(user.id);
    const checklist = await prisma.onboardingChecklist.findUnique({
      where: { applicationId: application.id },
      include: { items: { orderBy: { createdAt: "asc" } } }
    });
    return NextResponse.json({ checklist });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.onboarding",
      action: "api_failure",
      userId: user.id,
      entityType: "onboarding_checklist",
      fallbackMessage: "Onboarding progress could not be loaded."
    });
  }
}
