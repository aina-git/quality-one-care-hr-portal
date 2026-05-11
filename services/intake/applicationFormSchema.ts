// Field shape for intake step "application_form" — mirrors the Quality One Care
// "Employment Application" PDF exactly (QOC_Employment_Application_Form.pdf).

export const QOC_NURSING_DUTIES = [
  "Work with pediatric private duty nursing",
  "Adults",
  "G-tube care",
  "G-tube change",
  "G-tube feeding care",
  "GJ-tube care",
  "J-tube care",
  "Trach care",
  "Trach suction",
  "Trach change",
  "Ventilator care",
  "Cpap/Bipap care",
  "Medication administrations",
  "Nebulizer medications",
  "Urinary catheterization",
  "Colostomy/ileostomy care",
  "Central line care",
  "TPN administration",
  "Wound care"
] as const;

export const NURSING_DUTIES = QOC_NURSING_DUTIES;

export const EMPLOYMENT_TYPES = ["Full-Time", "Part-Time", "PRN / Per Diem", "Contract"] as const;
export const SHIFT_PREFERENCES = ["Day", "Evening", "Night", "Weekend", "Rotating"] as const;
export const PEDIATRIC_SETTINGS = [
  "Home / private duty",
  "NICU",
  "PICU",
  "Pediatric med-surg",
  "Pediatric outpatient",
  "School",
  "Other"
] as const;

export type EducationEntry = {
  nameAndLocation: string;
  yearsAttended: string;
  dateGraduated: string;
  degreeDiploma: string;
};

export type EmployerEntry = {
  employerName: string;
  employerPhone: string;
  employerAddress: string;
  from: string;
  to: string;
  positionJobTitle: string;
  supervisorName: string;
  supervisorPhone: string;
  startPay: string;
  endPay: string;
  reasonForLeaving: string;
  duties: string[];
  otherDuties: string;
};

export type ReferenceEntry = {
  name: string;
  relationship: string;
  phone: string;
};

export type ApplicationFormData = {
  // Personal Information (QOC PDF Section 1)
  firstName: string;
  lastName: string;
  dateOfApplication: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  ssn: string;
  usAuthorized: "yes" | "no" | "";
  phone: string;
  email: string;

  // Position Information
  positionAppliedFor: string;
  otherPosition: string;
  workPreference: string;
  shift: string;
  dateAvailableToWork: string;
  salaryDesired: string;

  // Background Questions
  felonyConviction: "yes" | "no" | "";
  felonyExplanation: string;
  appliedBefore: "yes" | "no" | "";
  currentlyEmployed: "yes" | "no" | "";
  mayContactEmployer: "yes" | "no" | "";

  // Education (QOC PDF table: High School, College, Certificate/License)
  highSchool: EducationEntry;
  college: EducationEntry;
  certificateLicense: EducationEntry;

  // Employment History (QOC PDF has 2 slots, we keep 3)
  employer1: EmployerEntry;
  employer2: EmployerEntry;
  employer3: EmployerEntry;

  // Experience Summary (bottom of QOC PDF employment section)
  pediatricYearsTotal: string;
  nonPediatricYearsTotal: string;

  // Extended clinical fields (internal use, not on PDF)
  pediatricYearsLast2: string;
  totalNursingYears: string;
  pediatricSettings: string[];
  pediatricSettingsOther: string;

  // Licensure (internal tracking)
  mdNursingLicenseNumber: string;
  mdNursingLicenseExp: string;
  cprProvider: string;
  cprExp: string;
  otherLicense: string;
  otherLicenseExp: string;

  // Personal References (QOC PDF section, 3 entries)
  reference1: ReferenceEntry;
  reference2: ReferenceEntry;
  reference3: ReferenceEntry;

  // Authorization / Signature
  signatureName: string;
  signatureDate: string;
};

export function emptyEducationEntry(): EducationEntry {
  return { nameAndLocation: "", yearsAttended: "", dateGraduated: "", degreeDiploma: "" };
}

export function emptyEmployerEntry(): EmployerEntry {
  return {
    employerName: "",
    employerPhone: "",
    employerAddress: "",
    from: "",
    to: "",
    positionJobTitle: "",
    supervisorName: "",
    supervisorPhone: "",
    startPay: "",
    endPay: "",
    reasonForLeaving: "",
    duties: [],
    otherDuties: ""
  };
}

export function emptyReferenceEntry(): ReferenceEntry {
  return { name: "", relationship: "", phone: "" };
}

export function emptyApplicationFormData(): ApplicationFormData {
  return {
    firstName: "",
    lastName: "",
    dateOfApplication: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    ssn: "",
    usAuthorized: "",
    phone: "",
    email: "",
    positionAppliedFor: "",
    otherPosition: "",
    workPreference: "",
    shift: "",
    dateAvailableToWork: "",
    salaryDesired: "",
    felonyConviction: "",
    felonyExplanation: "",
    appliedBefore: "",
    currentlyEmployed: "",
    mayContactEmployer: "",
    highSchool: emptyEducationEntry(),
    college: emptyEducationEntry(),
    certificateLicense: emptyEducationEntry(),
    employer1: emptyEmployerEntry(),
    employer2: emptyEmployerEntry(),
    employer3: emptyEmployerEntry(),
    pediatricYearsTotal: "",
    nonPediatricYearsTotal: "",
    pediatricYearsLast2: "",
    totalNursingYears: "",
    pediatricSettings: [],
    pediatricSettingsOther: "",
    mdNursingLicenseNumber: "",
    mdNursingLicenseExp: "",
    cprProvider: "",
    cprExp: "",
    otherLicense: "",
    otherLicenseExp: "",
    reference1: emptyReferenceEntry(),
    reference2: emptyReferenceEntry(),
    reference3: emptyReferenceEntry(),
    signatureName: "",
    signatureDate: ""
  };
}

export function mergeApplicationFormData(stored: unknown): ApplicationFormData {
  const empty = emptyApplicationFormData();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: ApplicationFormData = { ...empty };

  // Migrate legacy fields from the old schema shape
  if (obj.fullLegalName && typeof obj.fullLegalName === "string" && !obj.firstName) {
    const parts = (obj.fullLegalName as string).split(",").map((s: string) => s.trim());
    if (parts.length >= 2) {
      merged.lastName = parts[0];
      merged.firstName = parts[1];
    } else {
      const words = (obj.fullLegalName as string).trim().split(/\s+/);
      merged.firstName = words.slice(0, -1).join(" ");
      merged.lastName = words[words.length - 1] || "";
    }
  }
  if (obj.mailingAddress && typeof obj.mailingAddress === "string" && !obj.address) {
    merged.address = obj.mailingAddress as string;
  }
  if (obj.phoneMobile && typeof obj.phoneMobile === "string" && !obj.phone) {
    merged.phone = obj.phoneMobile as string;
  }
  if (obj.emailAddress && typeof obj.emailAddress === "string" && !obj.email) {
    merged.email = obj.emailAddress as string;
  }
  if (obj.authorizedToWorkUS && !obj.usAuthorized) {
    merged.usAuthorized = obj.authorizedToWorkUS as "yes" | "no" | "";
  }
  if (obj.hasConviction && !obj.felonyConviction) {
    merged.felonyConviction = obj.hasConviction as "yes" | "no" | "";
  }
  if (obj.convictionExplanation && typeof obj.convictionExplanation === "string" && !obj.felonyExplanation) {
    merged.felonyExplanation = obj.convictionExplanation as string;
  }
  if (obj.salaryExpected && typeof obj.salaryExpected === "string" && !obj.salaryDesired) {
    merged.salaryDesired = obj.salaryExpected as string;
  }
  if (obj.nonPediatricYears && typeof obj.nonPediatricYears === "string" && !obj.nonPediatricYearsTotal) {
    merged.nonPediatricYearsTotal = obj.nonPediatricYears as string;
  }
  // Migrate old flat education fields
  if (obj.highSchoolGed && typeof obj.highSchoolGed === "string") {
    if (!merged.highSchool.nameAndLocation) merged.highSchool.nameAndLocation = obj.highSchoolGed as string;
    if (obj.highSchoolYear && !merged.highSchool.dateGraduated) merged.highSchool.dateGraduated = obj.highSchoolYear as string;
  }
  if (obj.nursingSchool && typeof obj.nursingSchool === "string") {
    if (!merged.college.nameAndLocation) merged.college.nameAndLocation = obj.nursingSchool as string;
    if (obj.nursingSchoolYearDegree && !merged.college.degreeDiploma) merged.college.degreeDiploma = obj.nursingSchoolYearDegree as string;
  }

  function migrateEmployer(oldEmp: Record<string, unknown>): Partial<EmployerEntry> {
    const patch: Record<string, unknown> = {};
    if (oldEmp.positionTitle && !oldEmp.positionJobTitle) patch.positionJobTitle = oldEmp.positionTitle;
    if (oldEmp.datesEmployed && typeof oldEmp.datesEmployed === "string") {
      const dateParts = (oldEmp.datesEmployed as string).split(/[—–\-\/]/).map((s: string) => s.trim());
      if (!oldEmp.from) patch.from = dateParts[0] || "";
      if (!oldEmp.to) patch.to = dateParts[1] || "";
    }
    if (oldEmp.finalPayRate && !oldEmp.endPay) patch.endPay = oldEmp.finalPayRate as string;
    return patch as Partial<EmployerEntry>;
  }

  const nestedKeys = ["highSchool", "college", "certificateLicense", "employer1", "employer2", "employer3", "reference1", "reference2", "reference3"] as const;

  for (const k of Object.keys(empty) as Array<keyof ApplicationFormData>) {
    const value = obj[k as string];
    if (value === undefined || value === null) continue;

    if (nestedKeys.includes(k as (typeof nestedKeys)[number])) {
      if (typeof value !== "object") continue;
      const sub = value as Record<string, unknown>;
      if (k === "employer1" || k === "employer2" || k === "employer3") {
        const base = emptyEmployerEntry();
        const migration = migrateEmployer(sub);
        for (const ek of Object.keys(base) as Array<keyof EmployerEntry>) {
          const mv = migration[ek];
          const sv = sub[ek];
          const val = sv !== undefined && sv !== null ? sv : mv;
          if (val !== undefined && val !== null) (base as Record<string, unknown>)[ek] = val;
        }
        (merged as Record<string, unknown>)[k] = base;
      } else if (k === "highSchool" || k === "college" || k === "certificateLicense") {
        const base = emptyEducationEntry();
        for (const ek of Object.keys(base) as Array<keyof EducationEntry>) {
          if (sub[ek] !== undefined && sub[ek] !== null) (base as Record<string, unknown>)[ek] = sub[ek];
        }
        (merged as Record<string, unknown>)[k] = base;
      } else {
        const base = emptyReferenceEntry();
        for (const ek of Object.keys(base) as Array<keyof ReferenceEntry>) {
          if (sub[ek] !== undefined && sub[ek] !== null) (base as Record<string, unknown>)[ek] = sub[ek];
        }
        (merged as Record<string, unknown>)[k] = base;
      }
      continue;
    }
    (merged as Record<string, unknown>)[k] = value;
  }
  return merged;
}

function hasEmployer(e: EmployerEntry): boolean {
  return !!(e.employerName.trim() && e.positionJobTitle.trim() && e.from.trim());
}

function hasReference(r: ReferenceEntry): boolean {
  return !!(r.name.trim() && r.phone.trim());
}

export function validateApplicationFormForCompletion(data: ApplicationFormData): string[] {
  const errors: string[] = [];
  if (!data.firstName.trim()) errors.push("First name is required.");
  if (!data.lastName.trim()) errors.push("Last name is required.");
  if (!data.email.trim()) errors.push("Email address is required.");
  if (!data.phone.trim()) errors.push("Phone number is required.");
  if (!data.address.trim()) errors.push("Address is required.");
  if (!data.city.trim()) errors.push("City is required.");
  if (!data.state.trim()) errors.push("State is required.");
  if (!data.zipCode.trim()) errors.push("Zip code is required.");
  if (!/^\d{5}(-\d{4})?$/.test(data.zipCode.trim())) errors.push("Zip code must be 5 digits (or 5+4 format).");
  if (!data.ssn.trim()) errors.push("Social Security Number is required.");
  if (data.usAuthorized !== "yes" && data.usAuthorized !== "no") errors.push("Confirm US work authorization.");
  if (!data.positionAppliedFor.trim()) errors.push("Position applied for is required.");
  if (data.felonyConviction !== "yes" && data.felonyConviction !== "no") errors.push("Answer the felony conviction question.");
  if (data.felonyConviction === "yes" && !data.felonyExplanation.trim()) errors.push("Explain your felony conviction.");

  if (!data.highSchool.nameAndLocation.trim()) errors.push("High school name and location is required.");

  if (!hasEmployer(data.employer1) && !hasEmployer(data.employer2) && !hasEmployer(data.employer3)) {
    errors.push("At least one employer with name, job title, and start date is required.");
  }

  const refCount = [data.reference1, data.reference2, data.reference3].filter(hasReference).length;
  if (refCount < 2) errors.push("At least two references with name and phone number are required.");

  if (!data.signatureName.trim()) errors.push("Sign the application by typing your full legal name.");
  if (!data.signatureDate.trim()) errors.push("Signature date is required.");
  return errors;
}
