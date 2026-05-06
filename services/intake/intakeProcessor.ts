import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { classifyDocument } from "@/services/ai/documentClassifier";
import { extractFields } from "@/services/ai/fieldExtractor";
import { captureFailureLog } from "@/services/monitoring/errorService";
import { extractTextFromDocument } from "@/services/ocr/ocrService";
import { resolveDocumentPath } from "@/services/storage/storageService";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { organizeDocumentForIntake } from "@/services/intake/documentOrganizationService";
import { autoMapHighConfidenceFields } from "@/services/intake/mappingService";
import { analyzeDocumentWithProvider, getAnalysisSettings } from "@/services/analysis/documentAnalysisProvider";
import { reviewReasonForField, sourceSnippetFor } from "@/services/analysis/precisionReviewService";

// Minimum confidence for an extracted field to be promoted automatically into
// the applicant's structured profile rows. Below this, the field stays in
// pending_review for manual HR confirmation. Tunable via env if needed.
const AUTO_MAP_THRESHOLD = Number(process.env.AUTO_MAP_CONFIDENCE_THRESHOLD ?? 0.6);

export async function processUploadedDocument(documentId: string, userId: string) {
  const document = await prisma.uploadedDocument.findUnique({ where: { id: documentId } });
  if (!document?.applicationId) return;

  const job = await prisma.documentProcessingJob.create({
    data: {
      documentId,
      applicationId: document.applicationId,
      status: "processing",
      startedAt: new Date()
    }
  });

  await logAction(userId, "document_processing_started", "uploaded_document", documentId, { jobId: job.id });

  try {
    await prisma.uploadedDocument.update({ where: { id: documentId }, data: { processingStatus: "processing" } });

    const absolutePath = await resolveDocumentPath(document.storageKey);
    const ocr = await extractTextFromDocument(absolutePath, document.mimeType || document.documentType);
    const classification = classifyDocument(document.fileName, ocr.rawText);
    const extracted = extractFields(ocr.rawText, classification.detectedType);
    const analysisSettings = await getAnalysisSettings();
    const analysis = await analyzeDocumentWithProvider({
      documentId,
      rawText: ocr.rawText,
      fallbackDocumentType: classification.detectedType,
      userId
    });

    const extraction = await prisma.documentExtraction.create({
      data: {
        documentId,
        applicationId: document.applicationId,
        documentTypeDetected: classification.detectedType,
        confidence: Math.min(ocr.confidence, classification.confidence),
        rawText: ocr.rawText,
        extractedJson: {
          provider: ocr.provider,
          usedFallback: ocr.usedFallback,
          classificationReasoning: classification.reasoning,
          healthcareAccuracyStandard: "zero_guessing",
          providerAnalysis: analysis,
          fields: extracted
        }
      }
    });

    if (extracted.length > 0) {
      await prisma.extractedField.createMany({
        data: extracted.map((field) => ({
          extractionId: extraction.id,
          applicationId: document.applicationId!,
          sourceDocumentId: documentId,
          fieldKey: field.fieldKey,
          fieldLabel: field.fieldLabel,
          extractedValue: field.extractedValue,
          mappedSection: field.mappedSection,
          confidence: field.confidence,
          reviewReason: reviewReasonForField(field, analysisSettings.confidenceThreshold),
          sourceSnippet: sourceSnippetFor(ocr.rawText, field.extractedValue),
          sourceDocumentName: document.fileName,
          flaggedAt: field.confidence < analysisSettings.confidenceThreshold ? new Date() : undefined
        }))
      });
      for (const field of extracted.filter((candidate) => candidate.confidence < analysisSettings.confidenceThreshold)) {
        await logAction(userId, "field_flagged_low_confidence", "uploaded_document", documentId, {
          fieldKey: field.fieldKey,
          confidence: field.confidence,
          threshold: analysisSettings.confidenceThreshold,
          reason: reviewReasonForField(field, analysisSettings.confidenceThreshold)
        });
        await logAction(userId, "low_confidence_field_flagged", "uploaded_document", documentId, {
          fieldKey: field.fieldKey,
          confidence: field.confidence
        });
      }
    }

    // Bridge the extraction → structured profile gap. Promotes high-confidence
    // ExtractedField rows into ApplicantProfile / EmploymentHistory / License /
    // Certification / Reference so HR doesn't have to re-type what the OCR
    // already captured. Lower-confidence fields stay flagged for manual review.
    const autoMap = await autoMapHighConfidenceFields(document.applicationId, AUTO_MAP_THRESHOLD, userId);

    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: {
        processingStatus: "completed",
        detectedDocumentType: classification.detectedType,
        extractionConfidence: Math.min(ocr.confidence, classification.confidence)
      }
    });
    await prisma.documentProcessingJob.update({
      where: { id: job.id },
      data: { status: "completed", completedAt: new Date() }
    });
    await logAction(userId, "document_processing_completed", "uploaded_document", documentId, {
      detectedType: classification.detectedType,
      fieldCount: extracted.length,
      autoMapped: autoMap.mapped,
      autoMapPending: autoMap.skipped
    });
    await organizeDocumentForIntake(documentId, userId);
    await validateApplication(document.applicationId, userId);
  } catch (error) {
    await prisma.uploadedDocument.update({ where: { id: documentId }, data: { processingStatus: "failed" } });
    await prisma.documentProcessingJob.update({
      where: { id: job.id },
      data: { status: "failed", completedAt: new Date(), errorMessage: "Document processing failed. Manual review required." }
    });
    await logAction(userId, "document_processing_failed", "uploaded_document", documentId);
    await captureFailureLog({
      scope: "document.processing",
      action: "processing_failure",
      userId,
      entityType: "uploaded_document",
      entityId: documentId,
      error
    });
  }
}
