// Field shape for intake step "hep_b_declination" — mirrors the QOC
// Hepatitis B Vaccine Consent / Declination form (OSHA 29 CFR 1910.1030).

export const HEP_B_DECISIONS = ["consent", "decline", "already_received"] as const;
export type HepBDecision = (typeof HEP_B_DECISIONS)[number];

export const HEP_B_OSHA_STATEMENT =
  "I understand that due to my occupational exposure to blood or other potentially infectious materials I may be at risk of acquiring hepatitis B virus (HBV) infection. I have been given the opportunity to be vaccinated with hepatitis B vaccine, at no charge to myself. However, I decline hepatitis B vaccination at this time. I understand that by declining this vaccine, I continue to be at risk of acquiring hepatitis B, a serious disease. If in the future I continue to have occupational exposure to blood or other potentially infectious materials and I want to be vaccinated with hepatitis B vaccine, I can receive the vaccination series at no charge to me.";

export type HepBDose = {
  dateGiven: string;
  lotNumber: string;
  administeredBy: string;
  nextDateDue: string;
};

export type HepBData = {
  employeeFullName: string;
  employeeId: string;
  positionTitle: string;
  department: string;
  dateOfHire: string;
  dateOfDecision: string;
  decision: HepBDecision | "";
  dose1: HepBDose;
  dose2: HepBDose;
  dose3: HepBDose;
  acknowledgesDeclinationStatement: boolean;
  alreadyReceivedNote: string;
  signatureName: string;
  signatureDate: string;
};

export function emptyHepBDose(): HepBDose {
  return { dateGiven: "", lotNumber: "", administeredBy: "", nextDateDue: "" };
}

export function emptyHepBData(): HepBData {
  return {
    employeeFullName: "",
    employeeId: "",
    positionTitle: "",
    department: "Home Health Nursing",
    dateOfHire: "",
    dateOfDecision: "",
    decision: "",
    dose1: emptyHepBDose(),
    dose2: emptyHepBDose(),
    dose3: emptyHepBDose(),
    acknowledgesDeclinationStatement: false,
    alreadyReceivedNote: "",
    signatureName: "",
    signatureDate: ""
  };
}

export function mergeHepBData(stored: unknown): HepBData {
  const empty = emptyHepBData();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: HepBData = { ...empty };
  for (const key of Object.keys(empty) as Array<keyof HepBData>) {
    const val = obj[key as string];
    if (val === undefined || val === null) continue;
    if (key === "dose1" || key === "dose2" || key === "dose3") {
      const base = emptyHepBDose();
      const dose = val as Partial<HepBDose>;
      for (const dk of Object.keys(base) as Array<keyof HepBDose>) {
        if (dose[dk] !== undefined && dose[dk] !== null) base[dk] = String(dose[dk]);
      }
      (merged as Record<string, unknown>)[key] = base;
      continue;
    }
    (merged as Record<string, unknown>)[key] = val;
  }
  return merged;
}

export function validateHepBForCompletion(data: HepBData): string[] {
  const errors: string[] = [];
  if (!data.employeeFullName.trim()) errors.push("Employee full name is required.");
  if (!data.dateOfDecision.trim()) errors.push("Date of decision is required.");
  if (!data.decision) errors.push("Select Consent, Decline, or Already Received.");
  if (data.decision === "decline" && !data.acknowledgesDeclinationStatement) {
    errors.push("You must acknowledge the OSHA declination statement to decline.");
  }
  if (data.decision === "consent" && !data.dose1.dateGiven.trim()) {
    errors.push("Enter at least the 1st dose date if consenting to the vaccine.");
  }
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}
