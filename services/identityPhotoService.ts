import { prisma } from "@/lib/prisma";
import { sanitizeFileName } from "@/lib/security";
import { storeProtectedFile } from "@/services/storage/storageService";
import { AppError } from "@/services/monitoring/errorService";
import { logAction } from "@/lib/audit";

const maxPhotoSize = 5 * 1024 * 1024;
const minDimension = 400;
const allowed = new Set(["image/jpeg", "image/png"]);

function readPngDimensions(buffer: Buffer) {
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegDimensions(buffer: Buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

export function validateIdentityPhoto({
  buffer,
  mimeType,
  size
}: {
  buffer: Buffer;
  mimeType: string;
  size: number;
}) {
  if (!allowed.has(mimeType)) {
    throw new AppError("Upload a JPG or PNG identity photo.", { statusCode: 400, code: "PHOTO_TYPE_INVALID" });
  }
  if (size < 1 || size > maxPhotoSize) {
    throw new AppError("Identity photo must be 5MB or smaller.", { statusCode: 400, code: "PHOTO_SIZE_INVALID" });
  }
  const dimensions = mimeType === "image/png" ? readPngDimensions(buffer) : readJpegDimensions(buffer);
  if (!dimensions) {
    throw new AppError("Photo file could not be verified. Upload a valid JPG or PNG.", { statusCode: 400, code: "PHOTO_SIGNATURE_INVALID" });
  }
  if (dimensions.width < minDimension || dimensions.height < minDimension) {
    throw new AppError("Photo resolution must be at least 400x400 pixels.", { statusCode: 400, code: "PHOTO_RESOLUTION_INVALID" });
  }
  return dimensions;
}

export async function storeApplicantIdentityPhoto({
  applicantProfileId,
  userId,
  fileName,
  mimeType,
  size,
  buffer,
  source
}: {
  applicantProfileId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  source: "camera" | "upload";
}) {
  const dimensions = validateIdentityPhoto({ buffer, mimeType, size });
  const stored = await storeProtectedFile({
    fileName: sanitizeFileName(fileName || "profile-photo"),
    mimeType,
    buffer
  });
  const document = await prisma.uploadedDocument.create({
    data: {
      applicantProfileId,
      applicationId: null,
      documentType: "profile_photo",
      fileName: sanitizeFileName(fileName || "profile-photo"),
      storageKey: stored.storageKey,
      storageProvider: stored.storageProvider,
      mimeType,
      fileSize: size,
      processingStatus: "completed",
      detectedDocumentType: "profile_photo",
      extractionConfidence: 1,
      metadataJson: {
        checksum: stored.checksum,
        source,
        width: dimensions.width,
        height: dimensions.height,
        consent: true,
        use: "identity_verification_internal_employment_processing",
        noFacialRecognition: true
      }
    }
  });
  await prisma.applicantProfile.update({
    where: { id: applicantProfileId },
    data: {
      profilePhotoDocumentId: document.id,
      profilePhotoConsentAt: new Date(),
      identityPhotoStatus: "submitted",
      identityPhotoNotes: null,
      identityPhotoFlaggedAt: null,
      identityPhotoFlaggedById: null
    }
  });
  await logAction(userId, "photo_uploaded", "uploaded_document", document.id, {
    applicantProfileId,
    source,
    width: dimensions.width,
    height: dimensions.height
  });
  return document;
}
