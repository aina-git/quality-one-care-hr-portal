-- CreateEnum
CREATE TYPE "FinalVerificationStatus" AS ENUM ('draft', 'in_progress', 'ready_for_don_review', 'approved_by_don', 'rejected_by_don', 'returned_for_correction');

-- CreateEnum
CREATE TYPE "DonDecision" AS ENUM ('approved_for_hire', 'not_approved', 'returned_for_correction');

-- CreateEnum
CREATE TYPE "VerificationItemStatus" AS ENUM ('not_started', 'pending', 'verified', 'failed', 'expired', 'not_applicable', 'needs_followup');

-- CreateEnum
CREATE TYPE "VerificationCategory" AS ENUM ('employment_history', 'professional_employment_verification', 'character_reference', 'background_check_cgis', 'oig_exclusion', 'maryland_case_search', 'nursys', 'maryland_board_of_nursing', 'annual_physical_health', 'tb_test_or_chest_xray', 'liability_insurance_nso', 'cpr', 'id_or_work_authorization', 'sanitation_training', 'final_decision');

-- CreateEnum
CREATE TYPE "ExternalVerificationType" AS ENUM ('maryland_board_of_nursing', 'nursys', 'maryland_case_search', 'oig', 'cgis', 'nso', 'cpr', 'other');

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'final_not_approved';

-- CreateTable
CREATE TABLE "FinalVerificationChecklist" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "FinalVerificationStatus" NOT NULL DEFAULT 'draft',
    "preparedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "donDecision" "DonDecision",
    "donComment" TEXT,
    "submittedToDonAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalVerificationChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "category" "VerificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "status" "VerificationItemStatus" NOT NULL DEFAULT 'not_started',
    "result" TEXT,
    "source" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "documentId" TEXT,
    "externalReferenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalVerificationRecord" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "checklistItemId" TEXT,
    "verificationType" "ExternalVerificationType" NOT NULL,
    "providerName" TEXT NOT NULL,
    "searchUrl" TEXT,
    "searchDate" TIMESTAMP(3),
    "searchedByUserId" TEXT,
    "applicantNameUsed" TEXT,
    "licenseNumberUsed" TEXT,
    "trackingNumber" TEXT,
    "result" TEXT,
    "notes" TEXT,
    "evidenceDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalVerificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinalVerificationChecklist_applicationId_key" ON "FinalVerificationChecklist"("applicationId");

-- CreateIndex
CREATE INDEX "FinalVerificationChecklist_status_idx" ON "FinalVerificationChecklist"("status");

-- CreateIndex
CREATE INDEX "FinalVerificationChecklist_preparedByUserId_idx" ON "FinalVerificationChecklist"("preparedByUserId");

-- CreateIndex
CREATE INDEX "FinalVerificationChecklist_reviewedByUserId_idx" ON "FinalVerificationChecklist"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "FinalVerificationChecklist_approvedByUserId_idx" ON "FinalVerificationChecklist"("approvedByUserId");

-- CreateIndex
CREATE INDEX "VerificationChecklistItem_checklistId_idx" ON "VerificationChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "VerificationChecklistItem_category_idx" ON "VerificationChecklistItem"("category");

-- CreateIndex
CREATE INDEX "VerificationChecklistItem_status_idx" ON "VerificationChecklistItem"("status");

-- CreateIndex
CREATE INDEX "VerificationChecklistItem_expirationDate_idx" ON "VerificationChecklistItem"("expirationDate");

-- CreateIndex
CREATE INDEX "VerificationChecklistItem_documentId_idx" ON "VerificationChecklistItem"("documentId");

-- CreateIndex
CREATE INDEX "VerificationChecklistItem_verifiedByUserId_idx" ON "VerificationChecklistItem"("verifiedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationChecklistItem_checklistId_category_key" ON "VerificationChecklistItem"("checklistId", "category");

-- CreateIndex
CREATE INDEX "ExternalVerificationRecord_applicationId_idx" ON "ExternalVerificationRecord"("applicationId");

-- CreateIndex
CREATE INDEX "ExternalVerificationRecord_checklistItemId_idx" ON "ExternalVerificationRecord"("checklistItemId");

-- CreateIndex
CREATE INDEX "ExternalVerificationRecord_verificationType_idx" ON "ExternalVerificationRecord"("verificationType");

-- CreateIndex
CREATE INDEX "ExternalVerificationRecord_searchedByUserId_idx" ON "ExternalVerificationRecord"("searchedByUserId");

-- CreateIndex
CREATE INDEX "ExternalVerificationRecord_evidenceDocumentId_idx" ON "ExternalVerificationRecord"("evidenceDocumentId");

-- AddForeignKey
ALTER TABLE "FinalVerificationChecklist" ADD CONSTRAINT "FinalVerificationChecklist_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalVerificationChecklist" ADD CONSTRAINT "FinalVerificationChecklist_preparedByUserId_fkey" FOREIGN KEY ("preparedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalVerificationChecklist" ADD CONSTRAINT "FinalVerificationChecklist_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalVerificationChecklist" ADD CONSTRAINT "FinalVerificationChecklist_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationChecklistItem" ADD CONSTRAINT "VerificationChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "FinalVerificationChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationChecklistItem" ADD CONSTRAINT "VerificationChecklistItem_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationChecklistItem" ADD CONSTRAINT "VerificationChecklistItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UploadedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalVerificationRecord" ADD CONSTRAINT "ExternalVerificationRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalVerificationRecord" ADD CONSTRAINT "ExternalVerificationRecord_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "VerificationChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalVerificationRecord" ADD CONSTRAINT "ExternalVerificationRecord_searchedByUserId_fkey" FOREIGN KEY ("searchedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalVerificationRecord" ADD CONSTRAINT "ExternalVerificationRecord_evidenceDocumentId_fkey" FOREIGN KEY ("evidenceDocumentId") REFERENCES "UploadedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
