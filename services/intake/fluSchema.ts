// Field shape for intake step "flu_declination" — mirrors the QOC
// Influenza (Flu) Vaccine Consent / Declination form (CDC/ACIP guidance).

export const FLU_DECISIONS = ["consent", "decline", "already_received"] as const;
export type FluDecision = (typeof FLU_DECISIONS)[number];

export const FLU_DECLINE_REASONS = [
  "Medical contraindication",
  "Religious belief",
  "Personal preference",
  "Other"
] as const;
export type FluDeclineReason = (typeof FLU_DECLINE_REASONS)[number];

export const FLU_INFORMATION_BULLETS = [
  "Influenza vaccination is recommended for all healthcare personnel by the CDC Advisory Committee on Immunization Practices (ACIP) to reduce the risk of transmission to patients, especially vulnerable populations.",
  "Symptomatic and asymptomatic infected healthcare personnel can transmit influenza to patients before symptoms appear.",
  "The composition of seasonal influenza vaccines is updated annually based on circulating strains; vaccination is therefore recommended each year.",
  "Influenza vaccine cannot cause influenza. Mild side effects may occur.",
  "Personnel who decline vaccination remain at risk and may be required to wear a surgical mask during patient contact during influenza season."
];

export const FLU_ACKNOWLEDGEMENT =
  "I acknowledge that I have received and read the information about the influenza vaccine, have had the opportunity to ask questions, and have made my decision voluntarily. I understand that influenza vaccination is recommended but not mandated by Quality One Care Home Health, Inc. as a condition of employment, and that I may revisit this decision in a future season.";

export type FluVaccinationRecord = {
  dateGiven: string;
  lotNumber: string;
  administeredBy: string;
  manufacturer: string;
};

export type FluData = {
  employeeFullName: string;
  employeeId: string;
  positionTitle: string;
  department: string;
  influenzaSeason: string;
  dateOfDecision: string;
  decision: FluDecision | "";
  vaccinationRecord: FluVaccinationRecord;
  declineReason: FluDeclineReason | "";
  medicalContraindicationDetails: string;
  declineOtherDescription: string;
  alreadyReceivedNote: string;
  acknowledged: boolean;
  signatureName: string;
  signatureDate: string;
};

export function emptyFluVaccinationRecord(): FluVaccinationRecord {
  return { dateGiven: "", lotNumber: "", administeredBy: "", manufacturer: "" };
}

export function emptyFluData(): FluData {
  const now = new Date();
  const seasonGuess = now.getMonth() >= 6 ? `${now.getFullYear()}-${now.getFullYear() + 1}` : `${now.getFullYear() - 1}-${now.getFullYear()}`;
  return {
    employeeFullName: "",
    employeeId: "",
    positionTitle: "",
    department: "Home Health Nursing",
    influenzaSeason: seasonGuess,
    dateOfDecision: "",
    decision: "",
    vaccinationRecord: emptyFluVaccinationRecord(),
    declineReason: "",
    medicalContraindicationDetails: "",
    declineOtherDescription: "",
    alreadyReceivedNote: "",
    acknowledged: false,
    signatureName: "",
    signatureDate: ""
  };
}

export function mergeFluData(stored: unknown): FluData {
  const empty = emptyFluData();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: FluData = { ...empty };
  for (const key of Object.keys(empty) as Array<keyof FluData>) {
    const val = obj[key as string];
    if (val === undefined || val === null) continue;
    if (key === "vaccinationRecord") {
      const base = emptyFluVaccinationRecord();
      const rec = val as Partial<FluVaccinationRecord>;
      for (const k of Object.keys(base) as Array<keyof FluVaccinationRecord>) {
        if (rec[k] !== undefined && rec[k] !== null) base[k] = String(rec[k]);
      }
      merged.vaccinationRecord = base;
      continue;
    }
    (merged as Record<string, unknown>)[key] = val;
  }
  return merged;
}

export function validateFluForCompletion(data: FluData): string[] {
  const errors: string[] = [];
  if (!data.employeeFullName.trim()) errors.push("Employee full name is required.");
  if (!data.influenzaSeason.trim()) errors.push("Influenza season is required.");
  if (!data.dateOfDecision.trim()) errors.push("Date of decision is required.");
  if (!data.decision) errors.push("Select Consent, Decline, or Already Received.");
  if (data.decision === "consent" && !data.vaccinationRecord.dateGiven.trim()) {
    errors.push("Enter the date the influenza vaccine was given.");
  }
  if (data.decision === "decline") {
    if (!data.declineReason) errors.push("Select a reason for declining.");
    if (data.declineReason === "Medical contraindication" && !data.medicalContraindicationDetails.trim()) {
      errors.push("Specify the medical contraindication.");
    }
    if (data.declineReason === "Other" && !data.declineOtherDescription.trim()) {
      errors.push("Describe the 'Other' reason for declining.");
    }
  }
  if (!data.acknowledged) errors.push("Acknowledge that you have read the information and made your decision voluntarily.");
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}
