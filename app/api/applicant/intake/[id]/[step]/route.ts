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
import {
  mergeHepBData,
  validateHepBForCompletion
} from "@/services/intake/hepBSchema";
import {
  mergeFluData,
  validateFluForCompletion
} from "@/services/intake/fluSchema";
import {
  mergeJobDescriptionData,
  validateJobDescriptionForCompletion
} from "@/services/intake/jobDescriptionSchema";
import {
  mergeWageDeductionData,
  validateWageDeductionForCompletion
} from "@/services/intake/wageDeductionSchema";
import {
  mergePhysicalHealthData,
  validatePhysicalHealthForCompletion
} from "@/services/intake/physicalHealthSchema";
import {
  mergeCharacterReferenceData,
  validateCharacterReferenceForCompletion
} from "@/services/intake/characterReferenceSchema";
import {
  mergeDirectDepositData,
  validateDirectDepositForCompletion
} from "@/services/intake/directDepositSchema";
import {
  mergeW9Data,
  validateW9ForCompletion
} from "@/services/intake/w9Schema";

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
      // For Hep B specifically, we still want to persist the full form data
      // alongside the refusal so HR can see the OSHA acknowledgement and signature.
      if (stepKey === "hep_b_declination") {
        const data = mergeHepBData(body.data);
        const errors = validateHepBForCompletion(data);
        if (errors.length) return NextResponse.json({ error: errors[0] }, { status: 400 });
        const sigName = data.signatureName.trim().slice(0, 200);
        if (!sigName) return NextResponse.json({ error: "Signature required to decline." }, { status: 400 });
        await saveIntakeStepData({
          applicationId: id,
          stepKey,
          data,
          signatureName: sigName,
          markCompleted: false
        });
        await markIntakeStepRefused(id, stepKey, String(body.refusalReason ?? "").slice(0, 4000), sigName);
        await logAction(user.id, "intake.hep_b_declined", "intakeStep", `${id}:${stepKey}`, {});
        return NextResponse.json({ ok: true, status: "refused" });
      }
      if (stepKey === "flu_declination") {
        const data = mergeFluData(body.data);
        const errors = validateFluForCompletion(data);
        if (errors.length) return NextResponse.json({ error: errors[0] }, { status: 400 });
        const sigName = data.signatureName.trim().slice(0, 200);
        if (!sigName) return NextResponse.json({ error: "Signature required to decline." }, { status: 400 });
        await saveIntakeStepData({ applicationId: id, stepKey, data, signatureName: sigName, markCompleted: false });
        await markIntakeStepRefused(id, stepKey, String(body.refusalReason ?? "").slice(0, 4000), sigName);
        await logAction(user.id, "intake.flu_declined", "intakeStep", `${id}:${stepKey}`, { reason: data.declineReason });
        return NextResponse.json({ ok: true, status: "refused" });
      }
      const reason = String(body.refusalReason ?? "").slice(0, 4000);
      const sigName = String(body.signatureName ?? "").slice(0, 200);
      if (!sigName) return NextResponse.json({ error: "Signature required to refuse." }, { status: 400 });
      await markIntakeStepRefused(id, stepKey, reason, sigName);
      await logAction(user.id, "intake.step_refused", "intakeStep", `${id}:${stepKey}`, { stepKey });
      return NextResponse.json({ ok: true, status: "refused" });
    }

    if (stepKey === "hep_b_declination") {
      const data = mergeHepBData(body.data);
      const markCompleted = body.markCompleted === true;
      if (markCompleted) {
        const errors = validateHepBForCompletion(data);
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
      await logAction(user.id, markCompleted ? "intake.hep_b_submitted" : "intake.hep_b_saved", "intakeStep", `${id}:${stepKey}`, { decision: data.decision });
      return NextResponse.json({ ok: true, status: markCompleted ? "completed" : "in_progress" });
    }

    if (stepKey === "flu_declination") {
      const data = mergeFluData(body.data);
      const markCompleted = body.markCompleted === true;
      if (markCompleted) {
        const errors = validateFluForCompletion(data);
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
      await logAction(user.id, markCompleted ? "intake.flu_submitted" : "intake.flu_saved", "intakeStep", `${id}:${stepKey}`, { decision: data.decision });
      return NextResponse.json({ ok: true, status: markCompleted ? "completed" : "in_progress" });
    }

    if (stepKey === "job_description") {
      const data = mergeJobDescriptionData(body.data, "");
      const markCompleted = body.markCompleted === true;
      if (markCompleted) {
        const errors = validateJobDescriptionForCompletion(data);
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
      await logAction(user.id, markCompleted ? "intake.job_description_acknowledged" : "intake.job_description_saved", "intakeStep", `${id}:${stepKey}`, { selectedRole: data.selectedRole });
      return NextResponse.json({ ok: true, status: markCompleted ? "completed" : "in_progress" });
    }

    if (stepKey === "wage_deduction") {
      const data = mergeWageDeductionData(body.data);
      const markCompleted = body.markCompleted === true;
      if (markCompleted) {
        const errors = validateWageDeductionForCompletion(data);
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
      await logAction(user.id, markCompleted ? "intake.wage_deduction_signed" : "intake.wage_deduction_saved", "intakeStep", `${id}:${stepKey}`, {});
      return NextResponse.json({ ok: true, status: markCompleted ? "completed" : "in_progress" });
    }

    if (stepKey === "physical_health") {
      const data = mergePhysicalHealthData(body.data);
      const markCompleted = body.markCompleted === true;
      if (markCompleted) {
        const errors = validatePhysicalHealthForCompletion(data);
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
      await logAction(user.id, markCompleted ? "intake.physical_health_submitted" : "intake.physical_health_saved", "intakeStep", `${id}:${stepKey}`, { determination: data.determination });
      return NextResponse.json({ ok: true, status: markCompleted ? "completed" : "in_progress" });
    }

    if (stepKey === "character_reference") {
      const data = mergeCharacterReferenceData(body.data);
      const markCompleted = body.markCompleted === true;
      if (markCompleted) {
        const errors = validateCharacterReferenceForCompletion(data);
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
      await logAction(user.id, markCompleted ? "intake.character_reference_submitted" : "intake.character_reference_saved", "intakeStep", `${id}:${stepKey}`, {});
      return NextResponse.json({ ok: true, status: markCompleted ? "completed" : "in_progress" });
    }

    if (stepKey === "w9") {
      const data = mergeW9Data(body.data);
      const markCompleted = body.markCompleted === true;
      if (markCompleted) {
        const errors = validateW9ForCompletion(data);
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
      // Audit intentionally avoids capturing SSN/EIN.
      await logAction(user.id, markCompleted ? "intake.w9_submitted" : "intake.w9_saved", "intakeStep", `${id}:${stepKey}`, { tinType: data.tinType, classification: data.taxClassification });
      return NextResponse.json({ ok: true, status: markCompleted ? "completed" : "in_progress" });
    }

    if (stepKey === "direct_deposit") {
      const data = mergeDirectDepositData(body.data);
      const markCompleted = body.markCompleted === true;
      if (markCompleted) {
        const errors = validateDirectDepositForCompletion(data);
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
      // Audit log intentionally avoids capturing routing/account numbers.
      await logAction(user.id, markCompleted ? "intake.direct_deposit_submitted" : "intake.direct_deposit_saved", "intakeStep", `${id}:${stepKey}`, { action: data.action, hasSecondary: data.useSecondary });
      return NextResponse.json({ ok: true, status: markCompleted ? "completed" : "in_progress" });
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
