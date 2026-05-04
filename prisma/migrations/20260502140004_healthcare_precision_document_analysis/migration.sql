-- AlterTable
ALTER TABLE "ExtractedField" ADD COLUMN     "correctedAt" TIMESTAMP(3),
ADD COLUMN     "correctedByUserId" TEXT,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "hrOverrideAt" TIMESTAMP(3),
ADD COLUMN     "hrOverrideByUserId" TEXT,
ADD COLUMN     "hrOverrideNote" TEXT,
ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "sourceDocumentName" TEXT,
ADD COLUMN     "sourceSnippet" TEXT;

-- AlterTable
ALTER TABLE "ValidationIssue" ADD COLUMN     "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "requiredAction" TEXT,
ADD COLUMN     "responsibleParty" TEXT,
ADD COLUMN     "severityLabel" TEXT;

-- CreateTable
CREATE TABLE "DocumentAnalysisSetting" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'none',
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "lmstudioBaseUrl" TEXT,
    "lmstudioModel" TEXT,
    "ollamaBaseUrl" TEXT,
    "ollamaModel" TEXT,
    "groqModel" TEXT,
    "openrouterModel" TEXT,
    "localDocumentAnalyzerUrl" TEXT,
    "cloudUsageEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastAnalysisResult" JSONB,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAnalysisSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractedField_flaggedAt_idx" ON "ExtractedField"("flaggedAt");

-- CreateIndex
CREATE INDEX "ExtractedField_confidence_idx" ON "ExtractedField"("confidence");

-- CreateIndex
CREATE INDEX "ValidationIssue_responsibleParty_idx" ON "ValidationIssue"("responsibleParty");

-- CreateIndex
CREATE INDEX "ValidationIssue_flaggedAt_idx" ON "ValidationIssue"("flaggedAt");
