import type { VerificationCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { detectVerificationCategoryForDocument } from "@/services/verification/documentMatchingService";

function isClearIdentification(confidence: number | null | undefined, detectedType: string | null | undefined) {
  return Boolean(detectedType && detectedType !== "other" && (confidence ?? 0) >= 0.65);
}

export async function organizeDocumentForIntake(documentId: string, userId: string) {
  const document = await prisma.uploadedDocument.findUnique({
    where: { id: documentId },
    include: {
      application: {
        include: {
          finalVerificationChecklist: { include: { items: true } }
        }
      }
    }
  });
  if (!document?.application) return;

  const category = detectVerificationCategoryForDocument(document);
  const clear = isClearIdentification(document.extractionConfidence, document.detectedDocumentType);
  const metadata = document.metadataJson && typeof document.metadataJson === "object" && !Array.isArray(document.metadataJson)
    ? document.metadataJson as Record<string, unknown>
    : {};

  await prisma.uploadedDocument.update({
    where: { id: document.id },
    data: {
      metadataJson: {
        ...metadata,
        intakeEngine: "Document Intake Engine",
        suggestedDocumentType: document.detectedDocumentType ?? "other",
        suggestedVerificationCategory: category,
        organizationStatus: clear && category ? "matched" : "unsorted",
        unsortedReason: clear && category ? null : "Document type was uncertain and needs HR review."
      }
    }
  });

  if (clear && category && document.application.finalVerificationChecklist) {
    const item = document.application.finalVerificationChecklist.items.find((entry) => entry.category === category as VerificationCategory);
    if (item && !item.documentId) {
      await prisma.verificationChecklistItem.update({
        where: { id: item.id },
        data: {
          documentId: document.id,
          status: "pending_external_check",
          notes: "Auto-attached by Document Intake Engine. HR verification is still required."
        }
      });
      await logAction(userId, "document_auto_attached_to_verification", "uploaded_document", document.id, {
        applicationId: document.applicationId,
        checklistItemId: item.id,
        category
      });
    }
  }
}
