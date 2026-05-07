// Field shape for intake step "physical_health" — mirrors the QOC
// Pre-Employment Medical Clearance & TB Screening form.
//
// Section 1 is filled by the employee inline; sections 2–8 are filled by
// the examining provider on the printed/PDF form and then uploaded as
// proof. Applicant transcribes the key clearance + TB + immunization
// results back into this form so HR has structured data to track.

export type ImmunizationStatus = "up_to_date" | "in_progress" | "declined" | "";
export type TbTestType = "tst" | "igra" | "symptom_only" | "refused" | "";
export type TbResult = "negative" | "positive" | "indeterminate" | "";
export type ClearanceDetermination = "cleared" | "cleared_with_restriction" | "not_cleared" | "";
export type ExaminationStatus =
  | "not_scheduled"
  | "scheduled"
  | "completed"
  | ""
  ;

export type PhysicalHealthData = {
  // Section 1 — Employee
  employeeFullName: string;
  dateOfBirth: string;
  positionTitle: string;
  department: string;
  dateOfExamination: string;
  sexAtBirth: string;
  address: string;
  phone: string;
  email: string;
  knownAllergies: string;
  currentMedications: string;

  // Examination status
  examinationStatus: ExaminationStatus;

  // Section 2 — Provider (transcribed)
  providerName: string;
  providerLicense: string;
  providerPractice: string;
  providerPhone: string;

  // Section 4 — TB screening (transcribed)
  tbTestType: TbTestType;
  tbTestDate: string;
  tbReadDate: string;
  tbResult: TbResult;
  tbInductionMm: string;
  tbChestXrayResult: string;
  tbNotes: string;

  // Section 5 — Communicable disease
  freeOfCommunicableDisease: "yes" | "no" | "";

  // Section 6 — Immunizations (transcribed from provider verification)
  hepatitisB: ImmunizationStatus;
  influenza: ImmunizationStatus;
  mmr: ImmunizationStatus;
  varicella: ImmunizationStatus;
  tdap: ImmunizationStatus;
  covid19: ImmunizationStatus;

  // Section 8 — Determination
  determination: ClearanceDetermination;
  restrictionsNotes: string;
  nextReassessmentDate: string;

  // Applicant attestation
  applicantAttestation: boolean;
  signatureName: string;
  signatureDate: string;
};

export const SECTION_7_ESSENTIAL_FUNCTIONS = [
  "Lifting, transferring, and positioning patients up to 50 lbs (with assistance)",
  "Standing, walking, bending, and kneeling for extended periods",
  "Operating medical equipment safely",
  "Communicating clearly with patients, families, and the care team",
  "Driving to patient homes and managing time independently"
];

export function emptyPhysicalHealthData(): PhysicalHealthData {
  return {
    employeeFullName: "",
    dateOfBirth: "",
    positionTitle: "",
    department: "Home Health Nursing",
    dateOfExamination: "",
    sexAtBirth: "",
    address: "",
    phone: "",
    email: "",
    knownAllergies: "",
    currentMedications: "",
    examinationStatus: "",
    providerName: "",
    providerLicense: "",
    providerPractice: "",
    providerPhone: "",
    tbTestType: "",
    tbTestDate: "",
    tbReadDate: "",
    tbResult: "",
    tbInductionMm: "",
    tbChestXrayResult: "",
    tbNotes: "",
    freeOfCommunicableDisease: "",
    hepatitisB: "",
    influenza: "",
    mmr: "",
    varicella: "",
    tdap: "",
    covid19: "",
    determination: "",
    restrictionsNotes: "",
    nextReassessmentDate: "",
    applicantAttestation: false,
    signatureName: "",
    signatureDate: ""
  };
}

export function mergePhysicalHealthData(stored: unknown): PhysicalHealthData {
  const empty = emptyPhysicalHealthData();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: PhysicalHealthData = { ...empty };
  for (const k of Object.keys(empty) as Array<keyof PhysicalHealthData>) {
    if (obj[k as string] !== undefined && obj[k as string] !== null) {
      (merged as Record<string, unknown>)[k] = obj[k as string] as never;
    }
  }
  return merged;
}

export function validatePhysicalHealthForCompletion(data: PhysicalHealthData): string[] {
  const errors: string[] = [];
  if (!data.employeeFullName.trim()) errors.push("Employee full name is required.");
  if (!data.dateOfBirth.trim()) errors.push("Date of birth is required.");
  if (!data.examinationStatus) errors.push("Indicate whether the examination is scheduled or completed.");
  if (data.examinationStatus === "completed") {
    if (!data.dateOfExamination.trim()) errors.push("Date of examination is required after completion.");
    if (!data.providerName.trim()) errors.push("Provider name is required after completion.");
    if (!data.determination) errors.push("Provider clearance determination is required.");
    if (data.determination === "cleared_with_restriction" && !data.restrictionsNotes.trim()) {
      errors.push("Describe the restrictions or accommodations recommended by the provider.");
    }
    if (data.determination === "not_cleared" && !data.restrictionsNotes.trim()) {
      errors.push("Describe why the provider did not clear you.");
    }
    if (!data.tbTestType) errors.push("Record the TB screening test type.");
    if (data.tbTestType !== "refused" && data.tbTestType !== "" && !data.tbResult) {
      errors.push("Record the TB screening result.");
    }
  }
  if (!data.applicantAttestation) errors.push("Attest that the information you provided is accurate.");
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}
