// Field shape for intake step "new_hire_checklist" — the wizard-generated
// final summary. The applicant ticks each step's confirmation, signs the
// final acknowledgement, and the application becomes "ready for HR review".

import type { IntakeStepKey, IntakeStepStatus } from "@prisma/client";
import type { IntakeStepDef } from "./intakeWizardService";

export const NEW_HIRE_FINAL_ACKNOWLEDGEMENT =
  "I certify that I have completed every applicable step of the Quality One Care intake packet listed above, that the information I have provided is true and complete to the best of my knowledge, and that I understand my application will be reviewed by HR and (where required) the Director of Nursing before any offer is finalized. I authorize Quality One Care to verify all information provided.";

export type NewHireChecklistData = {
  acknowledgedSteps: Record<string, boolean>;
  finalAcknowledgement: boolean;
  signatureName: string;
  signatureDate: string;
};

export function emptyNewHireChecklistData(): NewHireChecklistData {
  return {
    acknowledgedSteps: {},
    finalAcknowledgement: false,
    signatureName: "",
    signatureDate: ""
  };
}

export function mergeNewHireChecklistData(stored: unknown): NewHireChecklistData {
  const empty = emptyNewHireChecklistData();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: NewHireChecklistData = { ...empty, acknowledgedSteps: { ...empty.acknowledgedSteps } };
  for (const k of Object.keys(empty) as Array<keyof NewHireChecklistData>) {
    const value = obj[k as string];
    if (value === undefined || value === null) continue;
    if (k === "acknowledgedSteps" && typeof value === "object") {
      const incoming = value as Record<string, unknown>;
      for (const key of Object.keys(incoming)) {
        merged.acknowledgedSteps[key] = Boolean(incoming[key]);
      }
      continue;
    }
    (merged as Record<string, unknown>)[k] = value;
  }
  return merged;
}

export type StepSummary = {
  def: IntakeStepDef;
  status: IntakeStepStatus;
};

export function validateNewHireChecklistForCompletion(
  data: NewHireChecklistData,
  upstream: StepSummary[]
): string[] {
  const errors: string[] = [];
  // Every prior applicable step (other than this final step itself) must be
  // either completed or refused — i.e., the applicant has explicitly worked
  // through it. Pending or in-progress upstream steps block submission.
  for (const step of upstream) {
    if (step.def.key === "new_hire_checklist") continue;
    if (step.status !== "completed" && step.status !== "refused" && step.status !== "skipped") {
      errors.push(`Finish "${step.def.title}" before final sign-off.`);
      return errors;
    }
    if (!data.acknowledgedSteps[step.def.key]) {
      errors.push(`Confirm completion of "${step.def.title}" by ticking its checkbox.`);
      return errors;
    }
  }
  if (!data.finalAcknowledgement) errors.push("Sign the final acknowledgement statement.");
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}

export function isStepKeyApplicable(key: IntakeStepKey | string, all: StepSummary[]) {
  return all.some((s) => s.def.key === key);
}
