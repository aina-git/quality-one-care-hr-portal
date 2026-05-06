import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

// GET — returns the raw OCR text + extracted-field summary for a single
// document. Lets HR see exactly what the OCR captured so we can diagnose
// missing-field issues without guessing at regex.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  try {
    await requireRole(["admin", "super_admin_hr", "hr"]);
    const { id, docId } = await params;
    const doc = await prisma.uploadedDocument.findFirst({
      where: { id: docId, applicationId: id }
    });
    if (!doc) throw new AppError("Document not found.", { statusCode: 404, code: "NOT_FOUND" });

    const extraction = await prisma.documentExtraction.findFirst({
      where: { documentId: docId },
      orderBy: { createdAt: "desc" }
    });

    const fields = await prisma.extractedField.findMany({
      where: { sourceDocumentId: docId },
      orderBy: [{ mappedSection: "asc" }, { fieldKey: "asc" }],
      select: {
        fieldKey: true,
        fieldLabel: true,
        mappedSection: true,
        extractedValue: true,
        confidence: true,
        status: true,
        applicantConfirmed: true
      }
    });

    return NextResponse.json({
      fileName: doc.fileName,
      processingStatus: doc.processingStatus,
      detectedDocumentType: doc.detectedDocumentType,
      extractionConfidence: doc.extractionConfidence,
      rawText: extraction?.rawText ?? null,
      extractionConfidenceFromExtraction: extraction?.confidence ?? null,
      provider: extraction
        ? (extraction.extractedJson as { provider?: string } | null)?.provider ?? null
        : null,
      fields
    });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.document.ocr",
      action: "read",
      entityType: "uploaded_document",
      fallbackMessage: "Could not load OCR text."
    });
  }
}
