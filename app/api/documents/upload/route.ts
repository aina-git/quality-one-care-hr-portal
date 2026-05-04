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

const maxSize = 10 * 1024 * 1024;
const allowedTypes = new Map([
  ["application/pdf", ".pdf"],
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"]
]);
const allowedCategories = new Set([
  // New simplified 5-bucket categories (the rebuild model)
  "Application Form",
  "Licenses & Background",
  "IDs / SSN / Passport",
  "Resume & Cover Letter",
  "Combined Package",
  // Legacy categories — kept for backward compatibility with existing data
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
const intakeModes = new Set(["digital", "paper", "supporting_documents"]);

function validateMagicBytes(buffer: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") {
    return buffer.subarray(0, 4).toString("utf8") === "%PDF";
  }
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8;
  }
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

export async function POST(request: Request) {
  const user = await requireRole(["applicant"]);

  try {
    const form = await request.formData();
    const file = form.get("file");
    const category = sanitizeText(form.get("category"), 120);
    const intakeModeValue = sanitizeText(form.get("intakeMode"), 80);
    const intakeMode = intakeModes.has(intakeModeValue) ? intakeModeValue : "supporting_documents";

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
      throw new AppError("File is too large. Maximum size is 10MB.", { statusCode: 400, code: "FILE_TOO_LARGE" });
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

    const profile = await prisma.applicantProfile.findUnique({
      where: { userId: user.id },
      include: { applications: { orderBy: { updatedAt: "desc" }, take: 1 } }
    });
    const application = profile?.applications[0];
    if (!profile || !application) {
      throw new AppError("Start your application before uploading documents.", { statusCode: 409, code: "APPLICATION_REQUIRED" });
    }
    if (application.status === "draft" && !(await prisma.uploadedDocument.count({ where: { applicationId: application.id } }))) {
      await logAction(user.id, "draft_application_auto_created", "application", application.id, { source: "document_intake_engine", intakeMode });
    }
    const stored = await storeProtectedFile({
      fileName: originalName,
      mimeType: file.type,
      buffer
    });

    const document = await prisma.uploadedDocument.create({
      data: {
        applicantProfileId: profile.id,
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
          organizationStatus: "processing"
        }
      }
    });

    if (intakeMode === "paper" || intakeMode === "supporting_documents") {
      const nextMode = intakeMode === "paper" ? "paper_intake" : "supporting_documents";
      await updateApplicationLifecycle({
        applicationId: application.id,
        userId: user.id,
        action: intakeMode === "paper" ? "paper_intake_started" : "document_intake_started",
        patch: {
          firstUploadAt: application.firstUploadAt ?? new Date()
        },
        details: { intakeMode }
      });
      await prisma.application.update({
        where: { id: application.id },
        data: { intakeMode: application.intakeMode === "paper_intake" ? "paper_intake" : nextMode, intakeType: nextMode }
      });
    } else if (!application.firstUploadAt) {
      await updateApplicationLifecycle({
        applicationId: application.id,
        userId: user.id,
        action: "first_upload_recorded",
        patch: { firstUploadAt: new Date() },
        details: { intakeMode }
      });
    }

    await logAction(user.id, "document_uploaded", "uploaded_document", document.id, {
      category,
      intakeMode,
      fileName: originalName,
      mimeType: file.type,
      fileSize: file.size
    });
    await logAction(user.id, "application_materials_uploaded", "uploaded_document", document.id, {
      applicationId: application.id,
      category,
      intakeMode
    });
    await processUploadedDocument(document.id, user.id);

    const updated = await prisma.uploadedDocument.findUnique({ where: { id: document.id } });
    return NextResponse.json({ document: updated });
  } catch (error) {
    return handleApiError(error, {
      scope: "documents.upload",
      action: "api_failure",
      userId: user.id,
      entityType: "uploaded_document",
      fallbackMessage: "Upload failed. Please try again with a supported file."
    });
  }
}
