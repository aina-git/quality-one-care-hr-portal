import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { resubmitAfterCorrection } from "@/services/workflow/resubmissionService";

export async function POST() {
  const user = await requireRole(["applicant"]);
  const { application } = await getOrCreateApplicantApplication(user.id);

  try {
    await resubmitAfterCorrection(application.id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Application could not be resubmitted.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
