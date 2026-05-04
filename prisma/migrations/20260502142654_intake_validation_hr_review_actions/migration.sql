-- AlterTable
ALTER TABLE "ValidationIssue" ADD COLUMN     "applicantActionStatus" TEXT,
ADD COLUMN     "applicantNote" TEXT,
ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "issueType" TEXT NOT NULL DEFAULT 'validation',
ADD COLUMN     "sourcesJson" JSONB;

-- CreateTable
CREATE TABLE "ApplicantFieldAssertion" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "issueType" TEXT NOT NULL DEFAULT 'applicant_claims_present',
    "note" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'hr_review_requested',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicantFieldAssertion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicantFieldAssertion_applicationId_idx" ON "ApplicantFieldAssertion"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicantFieldAssertion_fieldKey_idx" ON "ApplicantFieldAssertion"("fieldKey");

-- CreateIndex
CREATE INDEX "ApplicantFieldAssertion_status_idx" ON "ApplicantFieldAssertion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicantFieldAssertion_applicationId_fieldKey_issueType_so_key" ON "ApplicantFieldAssertion"("applicationId", "fieldKey", "issueType", "sourceDocumentId");

-- CreateIndex
CREATE INDEX "ValidationIssue_fieldKey_issueType_idx" ON "ValidationIssue"("fieldKey", "issueType");

-- AddForeignKey
ALTER TABLE "ApplicantFieldAssertion" ADD CONSTRAINT "ApplicantFieldAssertion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantFieldAssertion" ADD CONSTRAINT "ApplicantFieldAssertion_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "UploadedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
