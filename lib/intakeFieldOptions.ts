export const intakeFieldGroups = [
  { label: "Personal Information", fields: [["name", "Name"], ["dateOfBirth", "Date of Birth"], ["phone", "Phone"], ["email", "Email"], ["address", "Address"]] },
  { label: "Employment History", fields: [["employerName", "Employer name"], ["jobTitle", "Job title"], ["startDate", "Start date"], ["endDate", "End date"], ["supervisorName", "Supervisor"], ["supervisorPhone", "Supervisor phone"], ["reasonForLeaving", "Reason for leaving"]] },
  { label: "Experience", fields: [["hasPediatricExperience", "Pediatric experience"], ["skilledNursingExperience", "Skilled nursing experience"], ["homeHealthExperience", "Home health experience"], ["pediatricCareDuties", "Pediatric duties"]] },
  { label: "Licenses and Certifications", fields: [["licenseType", "License type"], ["licenseNumber", "License number"], ["issuingState", "Issuing authority"], ["issueDate", "Issue date"], ["expirationDate", "Expiration date"], ["certificationType", "Certification type"]] },
  { label: "Documents", fields: [["resume", "Resume"], ["scannedApplicationPage", "Scanned application page"], ["idFront", "ID front"], ["idBack", "ID back"], ["cpr", "CPR"], ["tbTest", "TB test"], ["physical", "Physical"], ["trainingCertificate", "Training certificate"], ["otherSupportingDocument", "Other supporting document"]] },
  { label: "References", fields: [["referenceName", "Reference name"], ["referencePhone", "Phone"], ["referenceEmail", "Email"], ["relationship", "Relationship"], ["employer", "Reference employer"]] }
] as const;

export const intakeFieldMeta = Object.fromEntries(
  intakeFieldGroups.flatMap((group) =>
    group.fields.map(([key, label]) => [key, { label, section: group.label === "Experience" ? "Pediatric Experience" : group.label }])
  )
) as Record<string, { label: string; section: string }>;
