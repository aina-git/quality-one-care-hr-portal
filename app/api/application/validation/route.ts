import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";

export async function GET() {
  const user = await requireRole(["applicant"]);
  const { application } = await getOrCreateApplicantApplication(user.id);
  const validation = await validateApplication(application.id, user.id);
  return NextResponse.json(validation);
}
