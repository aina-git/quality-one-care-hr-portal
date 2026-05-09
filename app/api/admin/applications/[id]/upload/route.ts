import AdmZip from "adm-zip";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { sanitizeFileName, sanitizeText } from "@/lib/security";
import { processUploadedDocument } from "@/services/intake/intakeProcessor";
import { AppError, handleApiError } from "@/services/monitoring/errorService";
import { storeProtectedFile } from "@/services/storage/storageService";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";

export const runtime = "nodejs";

// 50 MB cap. Real-world scanned PDFs (multi-page licenses, vaccine records,
// I-9 supporting docs) routinely exceed 10 MB. Bumped from 10 → 50 MB so
// applicants don't hit a wall mid-intake. The Server Actions body limit
// in next.config.ts is matched at 50 MB.
const maxSize = 50 * 1024 * 1024;
const allowedTypes = new Map([
  ["application/pdf", ".pdf"],
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"]
]);
const allowedCategories = new Set([
  "Application Form",
  "Licenses & Background",
  "IDs / SSN / Passport",
  "Resume & Cover Letter",
  "Combined Package",
  "Resume",
  "Scanned Application",
  "Scanned Application Form",
  "License",
  "Nursing License",
  "CPR Certificate",
  "CPR",
  "ID",
  "Medical",
  "Training",
  "Training Certificate",
  "Training Certificates",
  "Background Check",
  "Reference Document",
  "Reference Documents",
  "ID or Work Authorization",
  "Annual Physical",
  "TB Test or Chest X-ray",
  "NSO Insurance",
  "Other Supporting Document"
]);

function validateMagicBytes(buffer: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return buffer.subarray(0, 4).toString("utf8") === "%PDF";
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) return false;
    try {
      const zip = new AdmZip(buffer);
      return Boolean(zip.getEntry("[Content_Types].xml") && zip.getEntry("word/document.xml"));
    } catch {
      return false;
    }
  }
  return false;
}

// POST /api/admin/applications/[id]/upload
// Admin uploads a document on behalf of an applicant who submitted on paper.
// Same validation + AI pipeline as the applicant-facing upload, but the
// audit trail records the actor (admin/HR) and applicant separately.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireRole(["admin", "super_admin_hr"]);
  const { id: applicationId } = await context.params;

  try {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { applicantProfile: { include: { user: true } } }
    });
    if (!application) {
      throw new AppError("Application not found.", { statusCode: 404, code: "APPLICATION_NOT_FOUND" });
    }

    const form = await request.formData();
    const file = form.get("file");
    const category = sanitizeText(form.get("category"), 120);
    const intakeMode = "paper_intake";

    if (!(file instanceof File)) {
      throw new AppError("Please choose a document to upload.", { statusCode: 400, code: "FILE_REQUIRED" });
    }
    if (!allowedCategories.has(category)) {
      throw new AppError("Choose a valid document category.", { statusCode: 400, code: "CATEGORY_INVALID" });
    }
    if (!allowedTypes.has(file.type)) {
      throw new AppError("Unsupported file type. Upload PDF, PNG, JPG, JPEG, or DOCX.", { statusCode: 400, code: "MIME_INVALID" });
    }
    if (file.size < 1 || file.size > maxSize) {
      throw new AppError("File is too large. Maximum size is 50MB.", { statusCode: 400, code: "FILE_TOO_LARGE" });
    }

    const expectedExt = allowedTypes.get(file.type) ?? "";
    const originalName = sanitizeFileName(file.name || "document");
    if (!originalName.toLowerCase().endsWith(expectedExt)) {
      throw new AppError("File extension does not match the uploaded file type.", { statusCode: 400, code: "EXTENSION_MISMATCH" });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytes(buffer, file.type)) {
      throw new AppError("File content could not be verified. Please upload a valid document.", { statusCode: 400, code: "FILE_SIGNATURE_INVALID" });
    }

    const stored = await storeProtectedFile({ fileName: originalName, mimeType: file.type, buffer });

    const document = await prisma.uploadedDocument.create({
      data: {
        applicantProfileId: application.applicantProfileId,
        applicationId: application.id,
        documentType: category,
        fileName: originalName,
        storageKey: stored.storageKey,
        storageProvider: stored.storageProvider,
        mimeType: file.type,
        fileSize: file.size,
        metadataJson: {
          originalName,
          checksum: stored.checksum,
          lastModified: file.lastModified,
          intakeMode,
          intakeEngine: "Document Intake Engine",
          organizationStatus: "processing",
          uploadedByAdmin: true,
          uploadedByActorId: actor.id
        }
      }
    });

    await updateApplicationLifecycle({
      applicationId: application.id,
      userId: actor.id,
      action: "paper_intake_started",
      patch: { firstUploadAt: application.firstUploadAt ?? new Date() },
      details: { intakeMode, onBehalfOf: application.applicantProfile.user.id }
    });
    await prisma.application.update({
      where: { id: application.id },
      data: { intakeMode: "paper_intake", intakeType: "paper_intake" }
    });

    await logAction(actor.id, "document_uploaded_on_behalf", "uploaded_document", document.id, {
      applicationId: application.id,
      onBehalfOf: application.applicantProfile.user.id,
      category,
      fileName: originalName,
      mimeType: file.type,
      fileSize: file.size
    });

    // Run the AI / OCR pipeline as if the applicant had uploaded.
    await processUploadedDocument(document.id, application.applicantProfile.user.id);

    const updated = await prisma.uploadedDocument.findUnique({ where: { id: document.id } });
    return NextResponse.json({ document: updated });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.applications.upload",
      action: "api_failure",
      userId: actor.id,
      entityType: "uploaded_document",
      fallbackMessage: "Upload failed. Please try again with a supported file."
    });
  }
}
