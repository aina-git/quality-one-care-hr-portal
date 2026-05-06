// Field shape for intake step "application_form" — mirrors the Quality One Care
// "Application For Employment" PDF (XXX Application For Employment-1.pdf).

export const NURSING_DUTIES = [
  "Pediatric private duty nursing",
  "Adult / geriatric care",
  "Tracheostomy care & suctioning",
  "Mechanical ventilator management",
  "G-tube / J-tube / NG-tube feeding",
  "Wound care",
  "Medication administration (oral, IV, IM, SubQ)",
  "Central line care",
  "Urinary catheterization",
  "Colostomy / ileostomy care",
  "Seizure management",
  "Tracheostomy ties change",
  "Pulse oximetry / O2 administration",
  "Nebulizer treatment",
  "TPN administration",
  "CPAP / BiPAP management",
  "Chest physiotherapy",
  "Diabetic care / glucose monitoring"
] as const;

export const PEDIATRIC_SETTINGS = [
  "Home / private duty",
  "NICU",
  "PICU",
  "Pediatric med-surg",
  "Pediatric outpatient",
  "School",
  "Other"
] as const;

export const EMPLOYMENT_TYPES = ["Full-Time", "Part-Time", "PRN / Per Diem", "Contract"] as const;
export const SHIFT_PREFERENCES = ["Day", "Evening", "Night", "Weekend", "Rotating"] as const;

export type EmployerEntry = {
  employerName: string;
  employerPhone: string;
  employerAddress: string;
  positionTitle: string;
  datesEmployed: string;
  finalPayRate: string;
  reasonForLeaving: string;
  supervisorName: string;
  supervisorTitle: string;
  supervisorPhone: string;
  supervisorEmail: string;
  mayContactSupervisor: "yes" | "no" | "";
  duties: string[];
  otherDuties: string;
  pediatricYears: string;
  nonPediatricYears: string;
};

export type ApplicationFormData = {
  // Position Information
  positionAppliedFor: string;
  dateOfApplication: string;
  sourceOfReferral: string;
  dateAvailableToStart: string;
  employmentType: (typeof EMPLOYMENT_TYPES)[number] | "";
  shiftPreferences: string[];
  salaryExpected: string;
  isOver18: "yes" | "no" | "";

  // Personal Information
  fullLegalName: string;
  preferredName: string;
  mailingAddress: string;
  phoneMobile: string;
  phoneAlternate: string;
  emailAddress: string;
  yearsAtAddress: string;
  countryOfCitizenship: string;

  // Employment Eligibility
  authorizedToWorkUS: "yes" | "no" | "";
  requiresSponsorship: "yes" | "no" | "";

  // Professional Licensure
  mdNursingLicenseNumber: string;
  mdNursingLicenseExp: string;
  cprProvider: string;
  cprExp: string;
  otherLicense: string;
  otherLicenseExp: string;

  // Clinical Experience Summary
  pediatricYearsTotal: string;
  pediatricYearsLast2: string;
  nonPediatricYears: string;
  totalNursingYears: string;
  pediatricSettings: string[];
  pediatricSettingsOther: string;

  // Education
  highSchoolGed: string;
  highSchoolYear: string;
  nursingSchool: string;
  nursingSchoolYearDegree: string;
  additionalEducation: string;
  additionalEducationYear: string;

  // Employment History (3 employers)
  employer1: EmployerEntry;
  employer2: EmployerEntry;
  employer3: EmployerEntry;

  // Background — Criminal History
  hasConviction: "yes" | "no" | "";
  convictionExplanation: string;

  // ADA
  needsAccommodation: "yes" | "no" | "";
  accommodationDescription: string;

  // Certification
  signatureName: string;
  signatureDate: string;
};

export function emptyEmployerEntry(): EmployerEntry {
  return {
    employerName: "",
    employerPhone: "",
    employerAddress: "",
    positionTitle: "",
    datesEmployed: "",
    finalPayRate: "",
    reasonForLeaving: "",
    supervisorName: "",
    supervisorTitle: "",
    supervisorPhone: "",
    supervisorEmail: "",
    mayContactSupervisor: "",
    duties: [],
    otherDuties: "",
    pediatricYears: "",
    nonPediatricYears: ""
  };
}

export function emptyApplicationFormData(): ApplicationFormData {
  return {
    positionAppliedFor: "",
    dateOfApplication: "",
    sourceOfReferral: "",
    dateAvailableToStart: "",
    employmentType: "",
    shiftPreferences: [],
    salaryExpected: "",
    isOver18: "",
    fullLegalName: "",
    preferredName: "",
    mailingAddress: "",
    phoneMobile: "",
    phoneAlternate: "",
    emailAddress: "",
    yearsAtAddress: "",
    countryOfCitizenship: "",
    authorizedToWorkUS: "",
    requiresSponsorship: "",
    mdNursingLicenseNumber: "",
    mdNursingLicenseExp: "",
    cprProvider: "",
    cprExp: "",
    otherLicense: "",
    otherLicenseExp: "",
    pediatricYearsTotal: "",
    pediatricYearsLast2: "",
    nonPediatricYears: "",
    totalNursingYears: "",
    pediatricSettings: [],
    pediatricSettingsOther: "",
    highSchoolGed: "",
    highSchoolYear: "",
    nursingSchool: "",
    nursingSchoolYearDegree: "",
    additionalEducation: "",
    additionalEducationYear: "",
    employer1: emptyEmployerEntry(),
    employer2: emptyEmployerEntry(),
    employer3: emptyEmployerEntry(),
    hasConviction: "",
    convictionExplanation: "",
    needsAccommodation: "",
    accommodationDescription: "",
    signatureName: "",
    signatureDate: ""
  };
}

export function mergeApplicationFormData(stored: unknown): ApplicationFormData {
  const empty = emptyApplicationFormData();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: ApplicationFormData = { ...empty };
  for (const k of Object.keys(empty) as Array<keyof ApplicationFormData>) {
    const value = obj[k as string];
    if (value === undefined || value === null) continue;
    // Employer entries: merge per field
    if (k === "employer1" || k === "employer2" || k === "employer3") {
      const emp = value as Partial<EmployerEntry>;
      const base = emptyEmployerEntry();
      for (const ek of Object.keys(base) as Array<keyof EmployerEntry>) {
        if (emp[ek] !== undefined && emp[ek] !== null) {
          (base as Record<string, unknown>)[ek] = emp[ek] as never;
        }
      }
      (merged as Record<string, unknown>)[k] = base;
      continue;
    }
    (merged as Record<string, unknown>)[k] = value;
  }
  return merged;
}

export function validateApplicationFormForCompletion(data: ApplicationFormData): string[] {
  const errors: string[] = [];
  if (!data.positionAppliedFor.trim()) errors.push("Position applied for is required.");
  if (!data.fullLegalName.trim()) errors.push("Full legal name is required.");
  if (!data.emailAddress.trim()) errors.push("Email address is required.");
  if (!data.phoneMobile.trim()) errors.push("Mobile phone is required.");
  if (!data.mailingAddress.trim()) errors.push("Mailing address is required.");
  if (data.isOver18 !== "yes" && data.isOver18 !== "no") errors.push("Confirm whether you are 18 or older.");
  if (data.authorizedToWorkUS !== "yes" && data.authorizedToWorkUS !== "no") errors.push("Confirm US work authorization.");
  if (data.hasConviction !== "yes" && data.hasConviction !== "no") errors.push("Answer the criminal history question.");
  if (data.hasConviction === "yes" && !data.convictionExplanation.trim()) errors.push("Explain your criminal history disclosure.");
  if (!data.signatureName.trim()) errors.push("Sign the application by typing your full legal name.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}
