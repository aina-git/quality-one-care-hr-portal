import type { VerificationCategory } from "@prisma/client";

const categoryPatterns: Array<{ category: VerificationCategory; patterns: RegExp[] }> = [
  { category: "maryland_board_of_nursing", patterns: [/nursing license/i, /\blicense\b/i, /\brn\b/i, /\blpn\b/i] },
  { category: "nursys", patterns: [/nursys/i] },
  { category: "cpr", patterns: [/\bcpr\b/i, /\bbls\b/i] },
  { category: "annual_physical_health", patterns: [/annual physical/i, /physical/i, /health form/i] },
  { category: "tb_test_or_chest_xray", patterns: [/\btb\b/i, /chest x-?ray/i, /xray/i] },
  { category: "liability_insurance_nso", patterns: [/\bnso\b/i, /liability/i, /insurance/i] },
  { category: "id_or_work_authorization", patterns: [/\bid\b/i, /driver/i, /passport/i, /work authorization/i, /green card/i] },
  { category: "professional_employment_verification", patterns: [/employment verification/i, /professional reference/i] },
  { category: "character_reference", patterns: [/character/i, /reference/i] },
  { category: "background_check_cgis", patterns: [/\bcgis\b/i, /background/i] },
  { category: "sanitation_training", patterns: [/sanitation/i] }
];

export function detectVerificationCategoryForDocument(document: {
  documentType: string;
  fileName: string;
  detectedDocumentType?: string | null;
}): VerificationCategory | null {
  const text = `${document.documentType} ${document.fileName} ${document.detectedDocumentType ?? ""}`;
  return categoryPatterns.find((entry) => entry.patterns.some((pattern) => pattern.test(text)))?.category ?? null;
}

export function splitMatchedAndUnmatchedDocuments<
  TDocument extends { id: string; documentType: string; fileName: string; detectedDocumentType?: string | null },
  TItem extends { category: VerificationCategory; documentId: string | null }
>(documents: TDocument[], items: TItem[]) {
  const attachedIds = new Set(items.map((item) => item.documentId).filter(Boolean));
  const matched = documents
    .filter((document) => !attachedIds.has(document.id))
    .map((document) => ({ document, category: detectVerificationCategoryForDocument(document) }))
    .filter((entry): entry is { document: TDocument; category: VerificationCategory } => Boolean(entry.category));
  const matchedIds = new Set(matched.map((entry) => entry.document.id));
  return {
    matched,
    unmatched: documents.filter((document) => !attachedIds.has(document.id) && !matchedIds.has(document.id))
  };
}
