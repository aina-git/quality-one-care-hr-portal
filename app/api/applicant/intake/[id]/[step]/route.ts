import { NextResponse } from "next/server";
import { IntakeStepKey } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { handleApiError } from "@/services/monitoring/errorService";
import {
  saveIntakeStepData,
  markIntakeStepRefused
} from "@/services/intake/intakeWizardService";
import {
  mergeApplicationFormData,
  validateApplicationFormForCompletion
} from "@/services/intake/applicationFormSchema";

const VALID_STEPS: IntakeStepKey[] = [
  "application_form",
  "hep_b_declination",
  "flu_declination",
  "job_description",
  "wage_deduction",
  "physical_health",
  "character_reference",
  "direct_deposit",
  "w9",
  "w4",
  "mw507",
  "skills_checklist",
  "pre_employment_test",
  "application_updates",
  "new_hire_checklist"
];

export async function POST(request: Request, ctx: { params: Promise<{ id: string; step: string }> }) {
  try {
    const user = await requireRole(["applicant"]);
    const { id, step } = await ctx.params;
    if (!VALID_STEPS.includes(step as IntakeStepKey)) {
      return NextResponse.json({ error: "Unknown intake step." }, { status: 400 });
    }
    const application = await prisma.application.findUnique({
      where: { id },
      include: { applicantProfile: true }
    });
    if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (application.applicantProfile.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const stepKey = step as IntakeStepKey;

    if (body.refused === true) {
      const reason = String(body.refusalReason ?? "").slice(0, 4000);
      const sigName = String(body.signatureName ?? "").slice(0, 200);
      if (!sigName) return NextResponse.json({ error: "Signature required to refuse." }, { status: 400 });
      await markIntakeStepRefused(id, stepKey, reason, sigName);
      await logAction(user.id, "intake.step_refused", "intakeStep", `${id}:${stepKey}`, { stepKey });
      return NextResponse.json({ ok: true, status: "refused" });
    }

    if (stepKey === "application_form") {
      const data = mergeApplicationFormData(body.data);
      const markCompleted = body.markCompleted === true;
      if (markCompleted) {
        const errors = validateApplicationFormForCompletion(data);
        if (errors.length) return NextResponse.json({ error: errors[0] }, { status: 400 });
      }
      const sigName = data.signatureName.trim() ? data.signatureName.trim() : null;
      await saveIntakeStepData({
        applicationId: id,
        stepKey,
        data,
        signatureName: markCompleted ? sigName : null,
        markCompleted
      });
      await logAction(user.id, markCompleted ? "intake.application_form_submitted" : "intake.application_form_saved", "intakeStep", `${id}:${stepKey}`, {});
      return NextResponse.json({ ok: true, status: markCompleted ? "completed" : "in_progress" });
    }

    // Generic fallback for placeholder steps — accept JSON data, no validation yet.
    await saveIntakeStepData({
      applicationId: id,
      stepKey,
      data: body.data ?? {},
      markCompleted: body.markCompleted === true
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.intake",
      action: "post",
      entityType: "intakeStep",
      fallbackMessage: "Could not save intake step."
    });
  }
}
