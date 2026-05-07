// Field shape for intake step "w4" — IRS Form W-4 page 1 (Employee's
// Withholding Certificate).

export const W4_FILING_STATUSES = [
  "Single or Married filing separately",
  "Married filing jointly or Qualifying surviving spouse",
  "Head of household"
] as const;
export type W4FilingStatus = (typeof W4_FILING_STATUSES)[number];

export const W4_SIGNATURE_PENALTY =
  "Under penalties of perjury, I declare that this certificate, to the best of my knowledge and belief, is true, correct, and complete.";

export type W4Data = {
  // Step 1: Personal information
  firstNameAndMI: string;
  lastName: string;
  ssn: string;
  address: string;
  cityStateZip: string;
  filingStatus: W4FilingStatus | "";

  // Step 2: Multiple jobs or spouse works
  multipleJobsTwoJobsCheckbox: boolean; // 2(c) — exactly two jobs total

  // Step 3: Claim dependents
  qualifyingChildrenAmount: string; // $2,000 × #
  otherDependentsAmount: string; // $500 × #
  otherCredits: string;
  step3Total: string; // sum

  // Step 4 (optional)
  step4aOtherIncome: string;
  step4bDeductions: string;
  step4cExtraWithholding: string;

  // Step 5: Signature
  signatureName: string;
  signatureDate: string;
  acknowledgesPenalty: boolean;
};

export function emptyW4Data(): W4Data {
  return {
    firstNameAndMI: "",
    lastName: "",
    ssn: "",
    address: "",
    cityStateZip: "",
    filingStatus: "",
    multipleJobsTwoJobsCheckbox: false,
    qualifyingChildrenAmount: "",
    otherDependentsAmount: "",
    otherCredits: "",
    step3Total: "",
    step4aOtherIncome: "",
    step4bDeductions: "",
    step4cExtraWithholding: "",
    signatureName: "",
    signatureDate: "",
    acknowledgesPenalty: false
  };
}

export function mergeW4Data(stored: unknown): W4Data {
  const empty = emptyW4Data();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: W4Data = { ...empty };
  for (const k of Object.keys(empty) as Array<keyof W4Data>) {
    if (obj[k as string] !== undefined && obj[k as string] !== null) {
      (merged as Record<string, unknown>)[k] = obj[k as string] as never;
    }
  }
  return merged;
}

function isValidSsn(value: string) {
  return /^\d{9}$/.test(value.replace(/\D/g, ""));
}

export function validateW4ForCompletion(data: W4Data): string[] {
  const errors: string[] = [];
  if (!data.firstNameAndMI.trim()) errors.push("Step 1: First name (and middle initial) is required.");
  if (!data.lastName.trim()) errors.push("Step 1: Last name is required.");
  if (!isValidSsn(data.ssn)) errors.push("Step 1: Enter a valid 9-digit Social Security Number.");
  if (!data.address.trim()) errors.push("Step 1: Address is required.");
  if (!data.cityStateZip.trim()) errors.push("Step 1: City, state, ZIP is required.");
  if (!data.filingStatus) errors.push("Step 1(c): Choose a filing status.");
  if (!data.acknowledgesPenalty) errors.push("Step 5: Acknowledge the penalty-of-perjury declaration.");
  if (!data.signatureName.trim()) errors.push("Step 5: Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Step 5: Sign date is required.");
  return errors;
}
