-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "requestPath" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "EmailQueue" ADD COLUMN     "providerMessageId" TEXT;

-- AlterTable
ALTER TABLE "UploadedDocument" ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "storageProvider" TEXT;
