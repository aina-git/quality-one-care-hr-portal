// Field shape for intake step "job_description". Renders either the RN or LPN
// job description based on the applicant's selected role; applicant reads it
// in full and signs the acknowledgement.

export type JobDescriptionRole = "rn" | "lpn";

export type JobDescriptionContent = {
  title: string;
  shortName: string;
  positionSummary: string;
  qualifications: { label: string; text: string }[];
  duties: string[];
  physicalDemands: string[];
};

export const RN_JOB_DESCRIPTION: JobDescriptionContent = {
  title: "Registered Nurse (RN) — Job Description",
  shortName: "Registered Nurse",
  positionSummary:
    "The Registered Nurse (RN) provides skilled home health nursing services to pediatric and/or adult patients in their place of residence, in accordance with the Maryland Nurse Practice Act, applicable scope of practice, COMAR home health regulations, CMS Conditions of Participation, ANA Standards of Practice, and Quality One Care Home Health, Inc. policies. This position supervises LPNs, CNAs, and HHAs assigned to the RN's caseload.",
  qualifications: [
    { label: "Education", text: "Graduation from an accredited registered nursing program (Associate's or Bachelor's degree)." },
    { label: "Licensure", text: "Current, unencumbered Maryland RN license. Multistate license accepted under the Nurse Licensure Compact." },
    { label: "Experience", text: "Minimum two (2) years of clinical nursing experience, including at least one (1) year of pediatric patient care within the last two (2) years (per COMAR 10.09.53.03(C)(1)) for assignment to pediatric cases." },
    { label: "Certification", text: "Current American Heart Association BLS for Healthcare Providers (or equivalent). Specialty certifications (e.g., RN-BC, CCM, CHPN) preferred. Hepatitis B vaccination series (or signed declination per OSHA 29 CFR 1910.1030)." },
    { label: "Skills", text: "Demonstrated competence in skilled nursing for the assigned patient population, including pediatric private duty skills as applicable. Strong assessment, critical thinking, leadership, and supervisory skills." },
    { label: "Compliance", text: "Successful completion of pre-employment medical clearance, TB screening, criminal background check, drug screen, and OIG/SAM exclusion check." }
  ],
  duties: [
    "Conduct comprehensive nursing assessments and develop, implement, and evaluate the patient's plan of care in collaboration with the patient, family, physician, and interdisciplinary team.",
    "Provide direct patient care, including complex skilled procedures within RN scope: IV therapy, central line care, complex wound care, ventilator and tracheostomy management, chemotherapy administration where authorized.",
    "Administer medications across all routes within RN scope, monitor for therapeutic and adverse effects, and adjust nursing interventions accordingly.",
    "Supervise LPNs, CNAs, and HHAs in accordance with the Maryland Nurse Practice Act and COMAR home health requirements, including supervisory visits and competency validation.",
    "Develop and update the plan of care; communicate updates to the physician, case manager, and care team; obtain physician orders for any changes.",
    "Coordinate care with physicians, specialists, social workers, therapists, and durable medical equipment providers.",
    "Educate patients and families about diagnoses, medications, procedures, and self-management; verify understanding using teach-back methodology.",
    "Document nursing care, supervisory visits, OASIS (where applicable), and care coordination in the electronic health record by the end of shift.",
    "Identify, report, and escalate quality, safety, or compliance concerns; participate in performance improvement initiatives.",
    "Lead orientation, training, mentoring, and competency evaluation of nursing staff; serve as a clinical resource and role model.",
    "Maintain professional competency through continuing education, mandatory in-services, CPR/BLS, and annual TB and Hepatitis B compliance.",
    "Comply with HIPAA, OSHA, CMS Conditions of Participation, COMAR home health regulations, ANA Standards of Practice, and all Quality One Care policies and procedures.",
    "Participate in on-call rotation as assigned and respond to clinical questions from staff after hours.",
    "Perform other duties as assigned within RN scope of practice."
  ],
  physicalDemands: [
    "Lifting, transferring, and positioning patients up to 50 lbs (with assistance available)",
    "Standing, walking, bending, kneeling, and reaching for extended periods",
    "Manual dexterity for clinical procedures and operating medical equipment",
    "Visual acuity sufficient to read medication labels, electronic records, and monitor patient status",
    "Hearing acuity sufficient for auscultation and verbal communication, including alarms",
    "Driving a personal vehicle to patient homes; valid driver's license, current auto insurance, and reliable transportation required",
    "Possible exposure to bloodborne pathogens, infectious diseases, latex, and other clinical hazards; PPE provided per OSHA standards",
    "Working in patients' homes with variable environmental conditions (pets, smoke, climate)"
  ]
};

export const LPN_JOB_DESCRIPTION: JobDescriptionContent = {
  title: "Licensed Practical Nurse (LPN) — Job Description",
  shortName: "Licensed Practical Nurse",
  positionSummary:
    "The Licensed Practical Nurse (LPN) provides skilled home health nursing services to pediatric and/or adult patients in their place of residence, in accordance with the Maryland Nurse Practice Act, applicable scope of practice, COMAR home health regulations, CMS Conditions of Participation, ANA Standards of Practice, and Quality One Care Home Health, Inc. policies. This position supervises CNAs and HHAs assigned to the LPN's caseload.",
  qualifications: [
    { label: "Education", text: "Graduation from an accredited practical nursing program." },
    { label: "Licensure", text: "Current, unencumbered Maryland LPN license. Multistate license accepted under the Nurse Licensure Compact." },
    { label: "Experience", text: "Minimum two (2) years of clinical nursing experience, including at least one (1) year of pediatric patient care within the last two (2) years (per COMAR 10.09.53.03(C)(1)) for assignment to pediatric cases." },
    { label: "Certification", text: "Current American Heart Association BLS for Healthcare Providers (or equivalent). Hepatitis B vaccination series (or signed declination per OSHA 29 CFR 1910.1030)." },
    { label: "Skills", text: "Demonstrated competence in the clinical skills required for the assigned patient population, including pediatric private duty nursing skills as applicable. Strong written and verbal communication." },
    { label: "Compliance", text: "Successful completion of pre-employment medical clearance, TB screening, criminal background check, drug screen, and OIG/SAM exclusion check." }
  ],
  duties: [
    "Provide direct patient care under the direction of a Registered Nurse, in accordance with the Maryland Nurse Practice Act and the Maryland Board of Nursing scope of practice for licensed practical nurses.",
    "Implement the nursing plan of care developed by the RN: vital signs, focused assessments, observations, and documentation of patient response.",
    "Administer medications (oral, topical, subcutaneous, intramuscular, and via established enteral tubes) within LPN scope, observing the rights of medication administration and reporting adverse responses.",
    "Perform skilled procedures within LPN scope: dressing changes, urinary catheterization, tracheostomy care, suctioning, oxygen administration, G-tube/J-tube feeding, glucose monitoring.",
    "Reinforce patient and family education on disease processes, medication regimens, and self-care, using teach-back methodology.",
    "Communicate changes in the patient's condition to the supervising RN promptly; escalate emergencies per the agency response plan and call 911 when indicated.",
    "Supervise CNAs and HHAs on assigned cases per agency policy; conduct supervisory visits at the intervals required by Maryland regulation and document the supervisory contact.",
    "Maintain accurate, timely, legible clinical documentation in the electronic health record, including visit notes, MARs, and care coordination notes; complete documentation by the end of shift.",
    "Adhere to infection control practices including standard precautions, hand hygiene, PPE, and bloodborne pathogen procedures (29 CFR 1910.1030).",
    "Participate in the orientation, training, and ongoing competency assessment of new staff; serve as a clinical resource for CNAs and HHAs.",
    "Identify and escalate performance, safety, or quality concerns to the Director of Nursing in a timely manner.",
    "Maintain professional competency through continuing education, mandatory in-services, CPR/BLS, and annual TB and Hepatitis B compliance.",
    "Comply with HIPAA, OSHA, CMS, COMAR home health regulations, and all Quality One Care policies and procedures.",
    "Perform other duties as assigned within LPN scope of practice."
  ],
  physicalDemands: [
    "Lifting, transferring, and positioning patients up to 50 lbs (with assistance available)",
    "Standing, walking, bending, kneeling, and reaching for extended periods",
    "Manual dexterity for clinical procedures and operating medical equipment",
    "Visual acuity sufficient to read medication labels, electronic records, and monitor patient status",
    "Hearing acuity sufficient for auscultation and verbal communication, including alarms",
    "Driving a personal vehicle to patient homes; valid driver's license, current auto insurance, and reliable transportation required",
    "Possible exposure to bloodborne pathogens, infectious diseases, latex, and other clinical hazards; PPE provided per OSHA standards",
    "Working in patients' homes with variable environmental conditions (pets, smoke, climate)"
  ]
};

export const JOB_DESCRIPTION_ACKNOWLEDGEMENT =
  "I have read and understand this job description. I am able to perform the essential functions, with or without reasonable accommodation, and agree to perform the duties as outlined.";

export type JobDescriptionData = {
  selectedRole: JobDescriptionRole | "";
  acknowledged: boolean;
  ableToPerform: "yes" | "yes_with_accommodation" | "no" | "";
  accommodationDescription: string;
  signatureName: string;
  signatureDate: string;
};

export function emptyJobDescriptionData(): JobDescriptionData {
  return {
    selectedRole: "",
    acknowledged: false,
    ableToPerform: "",
    accommodationDescription: "",
    signatureName: "",
    signatureDate: ""
  };
}

export function inferRoleFromDesired(desired: string | null | undefined): JobDescriptionRole | "" {
  if (!desired) return "";
  if (/\blpn\b|practical/i.test(desired)) return "lpn";
  if (/\brn\b|registered/i.test(desired)) return "rn";
  return "";
}

export function mergeJobDescriptionData(stored: unknown, fallbackRole: JobDescriptionRole | ""): JobDescriptionData {
  const empty = emptyJobDescriptionData();
  if (!stored || typeof stored !== "object") {
    return { ...empty, selectedRole: fallbackRole };
  }
  const obj = stored as Record<string, unknown>;
  const merged: JobDescriptionData = { ...empty };
  for (const k of Object.keys(empty) as Array<keyof JobDescriptionData>) {
    if (obj[k as string] !== undefined && obj[k as string] !== null) {
      (merged as Record<string, unknown>)[k] = obj[k as string] as never;
    }
  }
  if (!merged.selectedRole && fallbackRole) merged.selectedRole = fallbackRole;
  return merged;
}

export function validateJobDescriptionForCompletion(data: JobDescriptionData): string[] {
  const errors: string[] = [];
  if (!data.selectedRole) errors.push("Choose RN or LPN before signing.");
  if (!data.acknowledged) errors.push("Acknowledge that you have read and understood this job description.");
  if (!data.ableToPerform) errors.push("Indicate whether you can perform the essential functions.");
  if (data.ableToPerform === "yes_with_accommodation" && !data.accommodationDescription.trim()) {
    errors.push("Describe the accommodation you would need.");
  }
  if (data.ableToPerform === "no") {
    errors.push("If you cannot perform the essential functions, please contact HR before signing.");
  }
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}

export function getJobDescriptionContent(role: JobDescriptionRole): JobDescriptionContent {
  return role === "lpn" ? LPN_JOB_DESCRIPTION : RN_JOB_DESCRIPTION;
}
