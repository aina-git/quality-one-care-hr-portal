import type { DetectedDocumentType } from "@/services/ai/documentClassifier";

export type ExtractedFieldCandidate = {
  fieldKey: string;
  fieldLabel: string;
  extractedValue: string;
  mappedSection: string;
  confidence: number;
};

const fieldMap: Record<string, { label: string; section: string }> = {
  firstName: { label: "First Name", section: "Personal Info" },
  lastName: { label: "Last Name", section: "Personal Info" },
  phone: { label: "Phone", section: "Personal Info" },
  email: { label: "Email", section: "Personal Info" },
  dateOfBirth: { label: "Date of Birth", section: "Personal Info" },
  address: { label: "Address", section: "Personal Info" },
  employerName: { label: "Employer Name", section: "Employment History" },
  jobTitle: { label: "Job Title", section: "Employment History" },
  startDate: { label: "Start Date", section: "Employment History" },
  endDate: { label: "End Date", section: "Employment History" },
  supervisorName: { label: "Supervisor Name", section: "Employment History" },
  supervisorPhone: { label: "Supervisor Phone", section: "Employment History" },
  hasPediatricExperience: { label: "Has Pediatric Experience", section: "Pediatric Experience" },
  pediatricExperienceYears: { label: "Pediatric Experience Years", section: "Pediatric Experience" },
  pediatricCareDuties: { label: "Pediatric Care Duties", section: "Pediatric Experience" },
  licenseType: { label: "License Type", section: "Licenses" },
  licenseNumber: { label: "License Number", section: "Licenses" },
  issuingState: { label: "Issuing State", section: "Licenses" },
  issueDate: { label: "Issue Date", section: "Licenses" },
  expirationDate: { label: "Expiration Date", section: "Licenses" },
  certificationType: { label: "Certification Type", section: "Certifications" },
  name: { label: "Reference Name", section: "References" },
  relationship: { label: "Relationship", section: "References" },
  employer: { label: "Reference Employer", section: "References" }
};

function match(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const found = text.match(pattern);
    const value = found?.[1]?.trim();
    if (value) return value.replace(/[,\n\r]+$/, "").trim();
  }
  return "";
}

function add(fields: ExtractedFieldCandidate[], key: string, value: string, confidence = 0.62) {
  const meta = fieldMap[key];
  if (!meta || !value) return;
  fields.push({
    fieldKey: key,
    fieldLabel: meta.label,
    extractedValue: value,
    mappedSection: meta.section,
    confidence
  });
}

export function extractFields(rawText: string, detectedType: DetectedDocumentType): ExtractedFieldCandidate[] {
  const text = rawText.replace(/\r/g, "\n");
  const fields: ExtractedFieldCandidate[] = [];

  const email = match(text, [/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i]);
  const phone = match(text, [/(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/]);
  const name = match(text, [/(?:name|applicant)\s*[:\-]\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)+)/i]);
  const address = match(text, [/(?:address)\s*[:\-]\s*([^\n]+)/i]);
  const dateOfBirth = match(text, [/(?:date of birth|dob|birth date)\s*[:\-]\s*([0-9/.-]+)/i]);
  if (name) {
    const parts = name.split(/\s+/);
    add(fields, "firstName", parts[0], 0.68);
    add(fields, "lastName", parts.slice(1).join(" "), 0.68);
  }
  add(fields, "email", email, 0.75);
  add(fields, "phone", phone, 0.72);
  add(fields, "dateOfBirth", dateOfBirth, 0.58);
  add(fields, "address", address, 0.62);

  add(fields, "employerName", match(text, [/(?:employer|company)\s*[:\-]\s*([^\n]+)/i]), 0.62);
  add(fields, "jobTitle", match(text, [/(?:job title|title|position|role)\s*[:\-]\s*([^\n]+)/i]), 0.62);
  add(fields, "startDate", match(text, [/(?:start date|from)\s*[:\-]\s*([0-9/.-]+)/i]), 0.58);
  add(fields, "endDate", match(text, [/(?:end date|to)\s*[:\-]\s*([0-9/.-]+)/i]), 0.58);
  add(fields, "supervisorName", match(text, [/(?:supervisor)\s*[:\-]\s*([^\n]+)/i]), 0.58);
  add(fields, "supervisorPhone", match(text, [/(?:supervisor phone)\s*[:\-]\s*([^\n]+)/i]), 0.58);

  if (/pediatric|children|child/i.test(text)) add(fields, "hasPediatricExperience", "yes", 0.64);
  add(fields, "pediatricExperienceYears", match(text, [/(?:pediatric experience|pediatric)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:years|yrs)/i]), 0.58);
  add(fields, "pediatricCareDuties", match(text, [/(?:pediatric duties|care duties|duties)\s*[:\-]\s*([^\n]+)/i]), 0.54);

  if (detectedType === "license" || /license|rn|lpn|cna/i.test(text)) {
    add(fields, "licenseType", match(text, [/\b(RN|LPN|CNA|NP)\b/i, /license type\s*[:\-]\s*([^\n]+)/i]) || "License", 0.64);
    add(fields, "licenseNumber", match(text, [/(?:license number|license no\.?|number)\s*[:\-]\s*([A-Z0-9-]+)/i]), 0.62);
    add(fields, "issuingState", match(text, [/(?:issuing state|state)\s*[:\-]\s*([A-Z]{2}|[A-Za-z ]+)/i]), 0.56);
    add(fields, "issueDate", match(text, [/(?:issue date|issued)\s*[:\-]\s*([0-9/.-]+)/i]), 0.56);
    add(fields, "expirationDate", match(text, [/(?:expiration date|expires|expiry)\s*[:\-]\s*([0-9/.-]+)/i]), 0.6);
  }

  if (detectedType === "cpr_certificate" || detectedType === "training_certificate") {
    add(fields, "certificationType", detectedType === "cpr_certificate" ? "CPR Certificate" : "Training Certificate", 0.74);
    add(fields, "issueDate", match(text, [/(?:issue date|issued|completed)\s*[:\-]\s*([0-9/.-]+)/i]), 0.56);
    add(fields, "expirationDate", match(text, [/(?:expiration date|expires|expiry)\s*[:\-]\s*([0-9/.-]+)/i]), 0.56);
  }

  if (detectedType === "reference_document") {
    add(fields, "name", match(text, [/(?:reference name|name)\s*[:\-]\s*([^\n]+)/i]), 0.62);
    add(fields, "relationship", match(text, [/(?:relationship)\s*[:\-]\s*([^\n]+)/i]), 0.58);
    add(fields, "employer", match(text, [/(?:employer|company)\s*[:\-]\s*([^\n]+)/i]), 0.58);
    add(fields, "email", email, 0.68);
    add(fields, "phone", phone, 0.68);
  }

  return fields;
}
