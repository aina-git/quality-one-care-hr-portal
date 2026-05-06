// Field shape for intake step "mw507" — Maryland Form MW507 (Employee's
// Maryland Withholding Exemption Certificate).

export const MD_COUNTIES = [
  "Allegany",
  "Anne Arundel",
  "Baltimore County",
  "Baltimore City",
  "Calvert",
  "Caroline",
  "Carroll",
  "Cecil",
  "Charles",
  "Dorchester",
  "Frederick",
  "Garrett",
  "Harford",
  "Howard",
  "Kent",
  "Montgomery",
  "Prince George's",
  "Queen Anne's",
  "Somerset",
  "St. Mary's",
  "Talbot",
  "Washington",
  "Wicomico",
  "Worcester"
] as const;

export const MW507_DOMICILE_STATES = ["Pennsylvania", "Virginia", "West Virginia", "Washington, D.C."] as const;

export const MW507_PENALTY_STATEMENT =
  "Under penalties of perjury, I certify that I am entitled to the number of withholding allowances claimed on this certificate or entitled to claim the exempt status, whichever is applicable.";

export type MW507Data = {
  // Personal information
  fullName: string;
  ssn: string;
  address: string;
  cityStateZip: string;
  countyOfResidence: string;
  singleFilingMaryland: boolean;
  marriedFilingMaryland: boolean;

  // Line 1 — total exemptions claimed
  line1Exemptions: string;

  // Line 2 — additional withholding per pay period
  line2AdditionalPerPay: string;

  // Lines 3–7 — exemption claims (boolean checkboxes with conditional text)
  line3NoMdLiability: boolean; // No MD liability last year, none expected this year
  line4DomiciledOtherState: boolean;
  line4DomicileState: string;
  line5PennsylvaniaResident: boolean;
  line6MilitarySpouseExempt: boolean;
  line7FederalExemptOccupation: boolean;
  line7Reason: string;

  // Signature
  signatureName: string;
  signatureDate: string;
  acknowledgesPenalty: boolean;
};

export function emptyMW507Data(): MW507Data {
  return {
    fullName: "",
    ssn: "",
    address: "",
    cityStateZip: "",
    countyOfResidence: "",
    singleFilingMaryland: false,
    marriedFilingMaryland: false,
    line1Exemptions: "",
    line2AdditionalPerPay: "",
    line3NoMdLiability: false,
    line4DomiciledOtherState: false,
    line4DomicileState: "",
    line5PennsylvaniaResident: false,
    line6MilitarySpouseExempt: false,
    line7FederalExemptOccupation: false,
    line7Reason: "",
    signatureName: "",
    signatureDate: "",
    acknowledgesPenalty: false
  };
}

export function mergeMW507Data(stored: unknown): MW507Data {
  const empty = emptyMW507Data();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: MW507Data = { ...empty };
  for (const k of Object.keys(empty) as Array<keyof MW507Data>) {
    if (obj[k as string] !== undefined && obj[k as string] !== null) {
      (merged as Record<string, unknown>)[k] = obj[k as string] as never;
    }
  }
  return merged;
}

function isValidSsn(value: string) {
  return /^\d{9}$/.test(value.replace(/\D/g, ""));
}

export function validateMW507ForCompletion(data: MW507Data): string[] {
  const errors: string[] = [];
  if (!data.fullName.trim()) errors.push("Name is required.");
  if (!isValidSsn(data.ssn)) errors.push("Enter a valid 9-digit Social Security Number.");
  if (!data.address.trim()) errors.push("Address is required.");
  if (!data.cityStateZip.trim()) errors.push("City, state, ZIP is required.");
  if (!data.countyOfResidence) errors.push("Choose your Maryland county of residence (or Baltimore City).");
  if (data.line4DomiciledOtherState && !data.line4DomicileState) {
    errors.push("If claiming Line 4 exemption, choose your state of domicile.");
  }
  if (data.line7FederalExemptOccupation && !data.line7Reason.trim()) {
    errors.push("If claiming Line 7 exemption, describe the federal-law basis.");
  }
  if (!data.acknowledgesPenalty) errors.push("Acknowledge the penalty-of-perjury declaration.");
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}
