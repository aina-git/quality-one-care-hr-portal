import { IntakeStepKey, IntakeStepStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type IntakeStepDef = {
  key: IntakeStepKey;
  title: string;
  shortLabel: string;
  description: string;
  appliesTo?: "all" | "nursing" | "existing_employee";
};

export const INTAKE_STEPS: IntakeStepDef[] = [
  { key: "application_form", title: "Application For Employment", shortLabel: "Application", description: "Position, personal info, employment history, and certification.", appliesTo: "all" },
  { key: "hep_b_declination", title: "Hepatitis B Vaccine Declination", shortLabel: "Hep B Declination", description: "Acknowledge or decline the Hepatitis B vaccine.", appliesTo: "all" },
  { key: "flu_declination", title: "Influenza Vaccine Declination", shortLabel: "Flu Declination", description: "Acknowledge or decline the seasonal influenza vaccine.", appliesTo: "all" },
  { key: "job_description", title: "Job Description (RN or LPN)", shortLabel: "Job Description", description: "Read and accept the job description for your role.", appliesTo: "nursing" },
  { key: "wage_deduction", title: "Consent to Withheld Checks", shortLabel: "Wage Deduction Consent", description: "Authorize wage deduction policy. Must be signed.", appliesTo: "all" },
  { key: "physical_health", title: "Pre-Employment Medical Clearance & TB Screening", shortLabel: "Physical Health", description: "Doctor-signed health form. Fill or upload.", appliesTo: "all" },
  { key: "character_reference", title: "Professional Reference", shortLabel: "Reference", description: "Upload completed professional reference form.", appliesTo: "all" },
  { key: "direct_deposit", title: "Direct Deposit Authorization", shortLabel: "Direct Deposit", description: "Bank routing/account + voided check.", appliesTo: "all" },
  { key: "w9", title: "Form W-9 (page 1)", shortLabel: "W-9", description: "Taxpayer ID & certification — page 1.", appliesTo: "all" },
  { key: "w4", title: "Form W-4 (page 1)", shortLabel: "W-4", description: "Federal employee withholding certificate — page 1.", appliesTo: "all" },
  { key: "mw507", title: "Form MW507 (Maryland Withholding)", shortLabel: "MW507", description: "Maryland state withholding exemption certificate.", appliesTo: "all" },
  { key: "skills_checklist", title: "Skills Competency Checklist", shortLabel: "Skills Checklist", description: "Self-rated nursing skill competency.", appliesTo: "nursing" },
  { key: "pre_employment_test", title: "Pre-Employment Clinical Test", shortLabel: "Clinical Test", description: "Final pre-employment clinical knowledge test.", appliesTo: "nursing" },
  { key: "application_updates", title: "Employee Application Updates", shortLabel: "App. Updates", description: "Existing employees only — refresh your application data.", appliesTo: "existing_employee" },
  { key: "new_hire_checklist", title: "New Hire Checklist", shortLabel: "Final Checklist", description: "Confirm every step is complete and sign off.", appliesTo: "all" }
];

export function isNursingRole(value: string | null | undefined) {
  return /\b(rn|lpn|nurse|nursing|skilled)\b/i.test(value ?? "");
}

export function applicableSteps(opts: { desiredRole?: string | null; isExistingEmployee?: boolean }): IntakeStepDef[] {
  const isNursing = isNursingRole(opts.desiredRole);
  const isExisting = Boolean(opts.isExistingEmployee);
  return INTAKE_STEPS.filter((step) => {
    if (step.appliesTo === "nursing") return isNursing;
    if (step.appliesTo === "existing_employee") return isExisting;
    return true;
  });
}

export async function getIntakeStep(applicationId: string, stepKey: IntakeStepKey) {
  return prisma.intakeStep.findUnique({
    where: { applicationId_stepKey: { applicationId, stepKey } },
    include: { attachedDocument: true }
  });
}

export async function getOrCreateIntakeStep(applicationId: string, stepKey: IntakeStepKey) {
  const existing = await getIntakeStep(applicationId, stepKey);
  if (existing) return existing;
  return prisma.intakeStep.create({
    data: { applicationId, stepKey, status: "not_started" },
    include: { attachedDocument: true }
  });
}

export async function listIntakeStepsForApplication(applicationId: string) {
  return prisma.intakeStep.findMany({
    where: { applicationId },
    include: { attachedDocument: true }
  });
}

export type StepProgress = {
  def: IntakeStepDef;
  status: IntakeStepStatus;
  hasData: boolean;
  signed: boolean;
};

export async function getIntakeProgress(applicationId: string, opts: { desiredRole?: string | null; isExistingEmployee?: boolean }): Promise<StepProgress[]> {
  const steps = applicableSteps(opts);
  const rows = await listIntakeStepsForApplication(applicationId);
  const map = new Map(rows.map((row) => [row.stepKey, row]));
  return steps.map((def) => {
    const row = map.get(def.key);
    return {
      def,
      status: row?.status ?? "not_started",
      hasData: Boolean(row?.data),
      signed: Boolean(row?.signatureSignedAt)
    };
  });
}

export async function saveIntakeStepData(opts: {
  applicationId: string;
  stepKey: IntakeStepKey;
  data: unknown;
  signatureName?: string | null;
  markCompleted?: boolean;
}) {
  const now = new Date();
  await getOrCreateIntakeStep(opts.applicationId, opts.stepKey);
  return prisma.intakeStep.update({
    where: { applicationId_stepKey: { applicationId: opts.applicationId, stepKey: opts.stepKey } },
    data: {
      data: opts.data as never,
      ...(opts.signatureName ? { signatureName: opts.signatureName, signatureSignedAt: now } : {}),
      ...(opts.markCompleted ? { status: "completed", completedAt: now } : { status: "in_progress" })
    }
  });
}

export async function markIntakeStepRefused(applicationId: string, stepKey: IntakeStepKey, refusalReason: string, signatureName: string) {
  const now = new Date();
  await getOrCreateIntakeStep(applicationId, stepKey);
  return prisma.intakeStep.update({
    where: { applicationId_stepKey: { applicationId, stepKey } },
    data: {
      status: "refused",
      refusedAt: now,
      data: { refusalReason } as never,
      signatureName,
      signatureSignedAt: now,
      completedAt: now
    }
  });
}

export function nextStepKey(current: IntakeStepKey, applicable: IntakeStepDef[]): IntakeStepKey | null {
  const idx = applicable.findIndex((s) => s.key === current);
  if (idx < 0 || idx >= applicable.length - 1) return null;
  return applicable[idx + 1].key;
}

export function previousStepKey(current: IntakeStepKey, applicable: IntakeStepDef[]): IntakeStepKey | null {
  const idx = applicable.findIndex((s) => s.key === current);
  if (idx <= 0) return null;
  return applicable[idx - 1].key;
}
