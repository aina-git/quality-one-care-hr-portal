import type { ApplicationSnapshot } from "@/services/review/applicationSnapshotService";

export function reviewDocuments(snapshot: ApplicationSnapshot) {
  const documentTypesDetected = Array.from(new Set(snapshot.documents.map((doc) => doc.detectedDocumentType ?? doc.documentType)));
  const missingExpectedDocuments: string[] = [];
  const lowConfidenceExtractions = snapshot.documents
    .filter((doc) => (doc.extractionConfidence ?? 1) < 0.5)
    .map((doc) => doc.fileName);
  const failedProcessingDocuments = snapshot.documents
    .filter((doc) => doc.processingStatus === "failed")
    .map((doc) => doc.fileName);
  const licensedRole = /nurse|rn|lpn|cna|skilled/i.test(snapshot.desiredRole ?? "");

  if (!documentTypesDetected.includes("resume")) missingExpectedDocuments.push("Resume");
  if (licensedRole && !documentTypesDetected.includes("license")) missingExpectedDocuments.push("License");

  return {
    uploadedDocumentCount: snapshot.documents.length,
    documentTypesDetected,
    missingExpectedDocuments,
    lowConfidenceExtractions,
    failedProcessingDocuments,
    summary: `${snapshot.documents.length} uploaded document(s) reviewed.`
  };
}
