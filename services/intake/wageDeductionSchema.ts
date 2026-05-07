// Field shape for intake step "wage_deduction" — mirrors the QOC
// Written Authorization for Wage Deduction (Maryland Code, Labor &
// Employment Article §3-503).
//
// At intake, the applicant signs the policy acknowledgement only. The
// per-incident fields (pay period, specific amount, reason checkboxes)
// are filled by HR if and when an actual deduction is needed.

export const WAGE_DEDUCTION_BULLETS = [
  "This authorization applies ONLY to the specific deduction described in this document.",
  "I have entered into this authorization voluntarily and after a meaningful opportunity to review.",
  "I may revoke this authorization in writing at any time prior to the deduction being processed.",
  "Documentation completion is a core responsibility of my role and a condition of timely payment."
];

export const WAGE_DEDUCTION_LEGAL_BASIS =
  "This form is executed pursuant to Maryland Code, Labor & Employment Article §3-503, which requires that any wage deduction not ordered by a court or otherwise authorized by law be expressly authorized in writing by the employee. This authorization is limited to the specific deduction described below.";

export const WAGE_DEDUCTION_OPENING =
  "I, the undersigned employee, hereby expressly authorize Quality One Care Home Health, Inc. to withhold from my next paycheck the specific amount described above. I understand and acknowledge:";

export type WageDeductionData = {
  employeeFullName: string;
  employeeId: string;
  positionTitle: string;
  department: string;
  acknowledgesAllBullets: boolean;
  acknowledgesDocumentationDuty: boolean;
  signatureName: string;
  signatureDate: string;
};

export function emptyWageDeductionData(): WageDeductionData {
  return {
    employeeFullName: "",
    employeeId: "",
    positionTitle: "",
    department: "Home Health Nursing",
    acknowledgesAllBullets: false,
    acknowledgesDocumentationDuty: false,
    signatureName: "",
    signatureDate: ""
  };
}

export function mergeWageDeductionData(stored: unknown): WageDeductionData {
  const empty = emptyWageDeductionData();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: WageDeductionData = { ...empty };
  for (const k of Object.keys(empty) as Array<keyof WageDeductionData>) {
    if (obj[k as string] !== undefined && obj[k as string] !== null) {
      (merged as Record<string, unknown>)[k] = obj[k as string] as never;
    }
  }
  return merged;
}

export function validateWageDeductionForCompletion(data: WageDeductionData): string[] {
  const errors: string[] = [];
  if (!data.employeeFullName.trim()) errors.push("Employee full name is required.");
  if (!data.acknowledgesAllBullets) errors.push("Acknowledge the four authorization terms.");
  if (!data.acknowledgesDocumentationDuty) errors.push("Acknowledge that documentation completion is a core duty.");
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}
