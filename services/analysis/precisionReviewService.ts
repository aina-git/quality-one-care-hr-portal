import type { ExtractedFieldCandidate } from "@/services/ai/fieldExtractor";

const defaultReasons: Record<string, string> = {
  firstName: "Name confidence is below healthcare verification threshold",
  lastName: "Name confidence is below healthcare verification threshold",
  dateOfBirth: "Date of birth could not be read clearly",
  address: "Address confidence is low or mismatch review is required",
  licenseNumber: "License number confidence is low",
  issueDate: "Issue date could not be read clearly",
  expirationDate: "Expiration date could not be read clearly",
  issuingState: "Issuing authority confidence is low",
  certificationType: "Certificate type confidence is low",
  documentType: "Document type confidence is low"
};

export function reviewReasonForField(field: Pick<ExtractedFieldCandidate, "fieldKey" | "fieldLabel" | "confidence">, threshold: number) {
  if (field.confidence >= threshold) return null;
  return defaultReasons[field.fieldKey] ?? `${field.fieldLabel ?? field.fieldKey} confidence is below the required ${Math.round(threshold * 100)}% threshold`;
}

export function sourceSnippetFor(rawText: string, value: string) {
  const clean = rawText.replace(/\s+/g, " ").trim();
  const index = value ? clean.toLowerCase().indexOf(value.toLowerCase()) : -1;
  if (index < 0) return clean.slice(0, 220);
  return clean.slice(Math.max(0, index - 80), Math.min(clean.length, index + value.length + 120));
}

export function healthcarePrecisionWarning() {
  return "This is a healthcare employment application. All extracted details must be reviewed with high precision. Uncertain data must be flagged for review. There is zero tolerance for errors.";
}
