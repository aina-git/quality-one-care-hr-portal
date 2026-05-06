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

function add(fields: ExtractedFieldCandidate[], key: string, value: string, confidence: number) {
  const meta = fieldMap[key];
  if (!meta || !value) return;
  fields.push({
    fieldKey: key,
    fieldLabel: meta.label,
    extractedValue: value.trim(),
    mappedSection: meta.section,
    confidence
  });
}

// Find a regex group-1 match while respecting an optional "exclude if line
// contains X" guard — this is what stops us mistaking a company FAX number
// in the page header for the applicant's phone.
function matchClean(
  text: string,
  patterns: RegExp[],
  options: { excludeLineRegex?: RegExp; maxLen?: number } = {}
): string {
  for (const pattern of patterns) {
    const found = text.match(pattern);
    const value = found?.[1]?.trim();
    if (!value) continue;
    if (options.excludeLineRegex) {
      // Re-find the surrounding line and skip if the exclude regex hits it.
      const index = text.indexOf(value);
      if (index >= 0) {
        const start = text.lastIndexOf("\n", index) + 1;
        const end = text.indexOf("\n", index);
        const line = text.slice(start, end === -1 ? undefined : end);
        if (options.excludeLineRegex.test(line)) continue;
      }
    }
    const cleaned = value.replace(/[,\n\r]+$/, "").trim();
    if (options.maxLen && cleaned.length > options.maxLen) continue;
    return cleaned;
  }
  return "";
}

// Heuristic: is this document about a *previous employer* describing the
// applicant from their side, rather than the applicant's own application?
// On those forms ("Employee Name", "Supervisor Name", etc.) every "Name:"
// label is about somebody other than our applicant.
function looksLikeEmploymentVerification(text: string): boolean {
  return /employment\s+verification\s+form/i.test(text)
      || /to\s+be\s+completed\s+by\s+(?:the\s+)?former\s+employer/i.test(text)
      || /verification\s+of\s+employment/i.test(text);
}

function looksLikeReferenceLetter(text: string): boolean {
  return /letter\s+of\s+reference/i.test(text)
      || /reference\s+letter/i.test(text)
      || /to\s+whom\s+it\s+may\s+concern/i.test(text);
}

// Conservative phone extractor:
//  - Look only on lines that mention applicant phone keywords (Cell, Mobile,
//    Home, Phone, Tel) AND don't say Fax / Office / Company.
//  - If no labelled hit, give up. Do NOT just grab the first phone-shape
//    that appears in the document — that picks up the company fax in the
//    page header.
function extractApplicantPhone(text: string): string {
  const lines = text.split(/\n+/);
  const phoneShape = /(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;
  const wantedLabel = /\b(cell\s*phone|mobile\s*phone|cell|mobile|home\s*phone|phone\s*number|telephone|tel)\b/i;
  const forbiddenLabel = /\b(fax|company\s*phone|office\s*phone|office\s*fax|employer\s*phone|supervisor\s*phone|reference\s*phone|emergency\s*contact)\b/i;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!wantedLabel.test(line)) continue;
    if (forbiddenLabel.test(line)) continue;
    const m = line.match(phoneShape);
    if (m) return m[1].trim();
  }
  return "";
}

// Conservative applicant-name extractor:
//  - Only match when the form has a clearly-applicant label like
//    "Applicant Name:", "Full Name:", "Your Name:", "Print Name:".
//  - Reject "Employee Name:", "Reference Name:", "Supervisor Name:",
//    "Contact Name:" — those are about somebody else on multi-page forms.
function extractApplicantName(text: string): string {
  const lines = text.split(/\n+/);
  const goodLabel = /^\s*(?:applicant(?:'s)?\s+name|full\s+name|your\s+name|legal\s+name|print\s+name|first\s*&\s*last\s+name|first\s+and\s+last\s+name)\s*[:\-]\s*(.+)$/i;
  const badContext = /\b(employee|reference|supervisor|contact|witness|authorized\s+by)\b/i;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (badContext.test(line)) continue;
    const m = line.match(goodLabel);
    if (!m) continue;
    const v = m[1].trim();
    // Sanity-check: must look like a name (letters + space, no digits).
    if (!/^[A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*)+$/.test(v)) continue;
    if (v.length > 80) continue;
    return v;
  }
  return "";
}

function extractEmail(text: string): string {
  return matchClean(text, [/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i]);
}

function extractAddress(text: string): string {
  // Only match an explicit "Home Address:" / "Street Address:" / "Mailing
  // Address:" label — bare "Address:" can refer to the company in a header.
  return matchClean(text, [
    /(?:home\s+address|street\s+address|mailing\s+address|residential\s+address)\s*[:\-]\s*([^\n]+)/i,
    /^\s*address\s*[:\-]\s*([^\n]+)$/im
  ], {
    excludeLineRegex: /\b(quality\s+one\s+care|company|employer|reference|supervisor)\b/i,
    maxLen: 240
  });
}

function extractPersonalInfo(text: string, fields: ExtractedFieldCandidate[]) {
  // Personal info only — NOT extracted from employment-verification or
  // reference-letter forms, because those forms ask about someone else.
  if (looksLikeEmploymentVerification(text) || looksLikeReferenceLetter(text)) return;

  const name = extractApplicantName(text);
  if (name) {
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      add(fields, "firstName", parts[0], 0.86);
      add(fields, "lastName", parts.slice(1).join(" "), 0.86);
    }
  }

  add(fields, "email", extractEmail(text), 0.9);
  add(fields, "phone", extractApplicantPhone(text), 0.85);
  add(fields, "address", extractAddress(text), 0.78);

  const dob = matchClean(text, [/(?:date\s+of\s+birth|dob|birth\s+date)\s*[:\-]\s*([0-9/.\-]+)/i]);
  add(fields, "dateOfBirth", dob, 0.7);
}

function extractEmploymentInfo(text: string, fields: ExtractedFieldCandidate[]) {
  // Employment fields — extract anywhere they appear (employment-verification
  // forms are actually a great source for these).
  const employer = matchClean(text, [
    /(?:name\s+of\s+(?:the\s+)?company|company\s+name|employer\s+name|previous\s+employer)\s*[:\-]\s*([^\n]+)/i
  ], { maxLen: 200 });
  if (employer) add(fields, "employerName", employer, 0.78);

  const job = matchClean(text, [
    /(?:job\s+title|position\s+title|role|title)\s*[:\-]\s*([^\n]+)/i
  ], { maxLen: 200 });
  if (job) add(fields, "jobTitle", job, 0.7);

  add(fields, "startDate", matchClean(text, [/(?:start\s+date|from\s+date|employment\s+date.*?from)\s*[:\-]?\s*([0-9/.\-]+)/i]), 0.65);
  add(fields, "endDate", matchClean(text, [/(?:end\s+date|to\s+date|until)\s*[:\-]?\s*([0-9/.\-]+)/i]), 0.65);

  const supervisor = matchClean(text, [
    /(?:name\s+of\s+supervisor|supervisor\s+name)\s*[:\-]\s*([^\n]+)/i
  ], { maxLen: 200 });
  if (supervisor) add(fields, "supervisorName", supervisor, 0.7);

  const supPhone = matchClean(text, [
    /(?:supervisor\s+phone|supervisor\s+contact|supervisor\s+tel)\s*[:\-]?\s*([0-9()+.\s\-]{7,})/i
  ], { maxLen: 30 });
  if (supPhone) add(fields, "supervisorPhone", supPhone, 0.7);
}

function extractLicenseInfo(text: string, detectedType: DetectedDocumentType, fields: ExtractedFieldCandidate[]) {
  if (detectedType !== "license" && !/license\s+(number|no\.?)\s*[:\-]/i.test(text)) return;

  const type = matchClean(text, [
    /\b(RN|LPN|CNA|HHA|NP|GNA)\b/,
    /(?:license\s+type|profession)\s*[:\-]\s*([^\n]+)/i
  ], { maxLen: 30 });
  if (type) add(fields, "licenseType", type, 0.85);

  add(fields, "licenseNumber", matchClean(text, [/(?:license\s+number|license\s+no\.?|number)\s*[:\-]\s*([A-Z0-9-]+)/i], { maxLen: 40 }), 0.82);
  add(fields, "issuingState", matchClean(text, [/(?:issuing\s+state|state)\s*[:\-]\s*([A-Z]{2})\b/i], { maxLen: 4 }), 0.7);
  add(fields, "issueDate", matchClean(text, [/(?:issue\s+date|issued)\s*[:\-]\s*([0-9/.\-]+)/i]), 0.7);
  add(fields, "expirationDate", matchClean(text, [/(?:expiration\s+date|expires|expiry)\s*[:\-]\s*([0-9/.\-]+)/i]), 0.78);
}

function extractCertificationInfo(text: string, detectedType: DetectedDocumentType, fields: ExtractedFieldCandidate[]) {
  if (detectedType === "cpr_certificate") {
    add(fields, "certificationType", "CPR Certificate", 0.9);
  } else if (detectedType === "training_certificate") {
    add(fields, "certificationType", "Training Certificate", 0.85);
  } else {
    return;
  }
  add(fields, "issueDate", matchClean(text, [/(?:issue\s+date|issued|completed)\s*[:\-]\s*([0-9/.\-]+)/i]), 0.7);
  add(fields, "expirationDate", matchClean(text, [/(?:expiration\s+date|expires|expiry)\s*[:\-]\s*([0-9/.\-]+)/i]), 0.78);
}

function extractReferenceInfo(text: string, detectedType: DetectedDocumentType, fields: ExtractedFieldCandidate[]) {
  // Only extract reference contact info from documents that look like
  // reference letters / forms, NOT from employment verification or
  // application packets (where "Reference Name:" of the *applicant* would
  // otherwise be misread as the reference's own name).
  if (detectedType !== "reference_document" && !looksLikeReferenceLetter(text)) return;

  const name = matchClean(text, [
    /(?:reference\s+name|name\s+of\s+reference)\s*[:\-]\s*([A-Za-z][A-Za-z'.\-\s]+)$/im
  ], { maxLen: 100 });
  if (name) add(fields, "name", name, 0.78);

  const relationship = matchClean(text, [
    /(?:relationship|how\s+do\s+you\s+know)\s*[:\-]\s*([^\n]+)/i
  ], { maxLen: 120 });
  if (relationship) add(fields, "relationship", relationship, 0.7);

  add(fields, "employer", matchClean(text, [/(?:reference\s+employer|company)\s*[:\-]\s*([^\n]+)/i], { maxLen: 120 }), 0.7);
  add(fields, "email", extractEmail(text), 0.78);
  add(fields, "phone", extractApplicantPhone(text), 0.7);
}

// We deliberately do NOT auto-detect "hasPediatricExperience" from raw text.
// The original keyword-presence test (any line containing the word
// "pediatric") false-positives on every document that mentions Quality One
// Care's name, the role description in the header, or a passing reference.
// A real Yes/No answer requires reading a checkbox, which Tesseract can't do
// reliably. HR can fill this manually via the HrPediatricExperienceEditor.

export function extractFields(rawText: string, detectedType: DetectedDocumentType): ExtractedFieldCandidate[] {
  const text = rawText.replace(/\r/g, "\n");
  const fields: ExtractedFieldCandidate[] = [];

  extractPersonalInfo(text, fields);
  extractEmploymentInfo(text, fields);
  extractLicenseInfo(text, detectedType, fields);
  extractCertificationInfo(text, detectedType, fields);
  extractReferenceInfo(text, detectedType, fields);

  return fields;
}
