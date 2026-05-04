-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ExtractedFieldStatus" AS ENUM ('pending_review', 'accepted', 'corrected', 'rejected', 'needs_manual_entry');

-- CreateEnum
CREATE TYPE "ValidationSeverity" AS ENUM ('info', 'warning', 'blocking');

-- AlterTable
ALTER TABLE "Certification" ADD COLUMN     "issueDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EmploymentHistory" ADD COLUMN     "duties" TEXT,
ADD COLUMN     "supervisorName" TEXT,
ADD COLUMN     "supervisorPhone" TEXT;

-- AlterTable
ALTER TABLE "License" ADD COLUMN     "issueDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reference" ADD COLUMN     "employer" TEXT;

-- AlterTable
ALTER TABLE "UploadedDocument" ADD COLUMN     "detectedDocumentType" TEXT,
ADD COLUMN     "extractionConfidence" DOUBLE PRECISION,
ADD COLUMN     "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "DocumentProcessingJob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExtraction" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentTypeDetected" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rawText" TEXT NOT NULL,
    "extractedJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "extractedValue" TEXT NOT NULL,
    "mappedSection" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "applicantConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "applicantCorrectedValue" TEXT,
    "status" "ExtractedFieldStatus" NOT NULL DEFAULT 'pending_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationIssue" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "severity" "ValidationSeverity" NOT NULL,
    "section" TEXT NOT NULL,
    "fieldKey" TEXT,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentProcessingJob_documentId_idx" ON "DocumentProcessingJob"("documentId");

-- CreateIndex
CREATE INDEX "DocumentProcessingJob_applicationId_idx" ON "DocumentProcessingJob"("applicationId");

-- CreateIndex
CREATE INDEX "DocumentProcessingJob_status_idx" ON "DocumentProcessingJob"("status");

-- CreateIndex
CREATE INDEX "DocumentExtraction_documentId_idx" ON "DocumentExtraction"("documentId");

-- CreateIndex
CREATE INDEX "DocumentExtraction_applicationId_idx" ON "DocumentExtraction"("applicationId");

-- CreateIndex
CREATE INDEX "ExtractedField_applicationId_idx" ON "ExtractedField"("applicationId");

-- CreateIndex
CREATE INDEX "ExtractedField_extractionId_idx" ON "ExtractedField"("extractionId");

-- CreateIndex
CREATE INDEX "ExtractedField_status_idx" ON "ExtractedField"("status");

-- CreateIndex
CREATE INDEX "ValidationIssue_applicationId_idx" ON "ValidationIssue"("applicationId");

-- CreateIndex
CREATE INDEX "ValidationIssue_severity_idx" ON "ValidationIssue"("severity");

-- CreateIndex
CREATE INDEX "ValidationIssue_resolved_idx" ON "ValidationIssue"("resolved");

-- AddForeignKey
ALTER TABLE "DocumentProcessingJob" ADD CONSTRAINT "DocumentProcessingJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UploadedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentProcessingJob" ADD CONSTRAINT "DocumentProcessingJob_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UploadedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "DocumentExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "UploadedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationIssue" ADD CONSTRAINT "ValidationIssue_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
