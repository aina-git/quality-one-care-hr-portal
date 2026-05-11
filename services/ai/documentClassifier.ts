export type DetectedDocumentType =
  | "resume"
  | "application_form"
  | "license"
  | "cpr_certificate"
  | "id_document"
  | "medical_document"
  | "training_certificate"
  | "background_check"
  | "reference_document"
  | "other";

export type ClassificationResult = {
  detectedType: DetectedDocumentType;
  confidence: number;
  reasoning: string;
};

const rules: Array<{ type: DetectedDocumentType; confidence: number; patterns: RegExp[]; reason: string }> = [
  { type: "resume", confidence: 0.88, patterns: [/resume/i, /\bcv\b/i], reason: "Filename or text references a resume/CV." },
  { type: "license", confidence: 0.86, patterns: [/license/i, /\brn\b/i, /\blpn\b/i, /\bcna\b/i], reason: "License-related keyword found." },
  { type: "cpr_certificate", confidence: 0.86, patterns: [/\bcpr\b/i, /\bbls\b/i], reason: "CPR/BLS keyword found." },
  { type: "id_document", confidence: 0.82, patterns: [/\bid\b/i, /driver/i, /passport/i, /work authorization/i, /green card/i], reason: "ID or work authorization keyword found." },
  { type: "medical_document", confidence: 0.8, patterns: [/annual physical/i, /\btb\b/i, /chest x-?ray/i, /medical/i, /health form/i], reason: "Medical or health document keyword found." },
  { type: "training_certificate", confidence: 0.78, patterns: [/training/i, /certificate/i], reason: "Training or certificate keyword found." },
  { type: "background_check", confidence: 0.82, patterns: [/background/i, /\bcgis\b/i, /case search/i, /\boig\b/i], reason: "Background or external check keyword found." },
  { type: "reference_document", confidence: 0.82, patterns: [/reference/i, /recommendation/i], reason: "Reference keyword found." },
  { type: "application_form", confidence: 0.82, patterns: [/application/i, /applicant/i], reason: "Application form keyword found." }
];

export function classifyDocument(fileName: string, rawText: string): ClassificationResult {
  const haystack = `${fileName}\n${rawText}`;
  if (/application/i.test(fileName) || /employment application|qoc employment checklist|table of checklist for employment verification/i.test(rawText)) {
    const isQoc = /quality\s+one\s+care/i.test(rawText) || /qoc/i.test(fileName);
    return {
      detectedType: "application_form",
      confidence: isQoc ? 0.95 : 0.9,
      reasoning: isQoc
        ? "QOC Employment Application form detected from company branding and application keywords."
        : "Scanned employment application package detected from filename or packet headings."
    };
  }
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return { detectedType: rule.type, confidence: rule.confidence, reasoning: rule.reason };
    }
  }

  return {
    detectedType: "other",
    confidence: 0.35,
    reasoning: "No strong filename or text keyword matched a supported document type."
  };
}
