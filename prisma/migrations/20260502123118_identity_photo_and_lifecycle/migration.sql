-- AlterTable
ALTER TABLE "ApplicantProfile" ADD COLUMN     "identityPhotoFlaggedAt" TIMESTAMP(3),
ADD COLUMN     "identityPhotoFlaggedById" TEXT,
ADD COLUMN     "identityPhotoNotes" TEXT,
ADD COLUMN     "identityPhotoStatus" TEXT DEFAULT 'pending',
ADD COLUMN     "profilePhotoConsentAt" TIMESTAMP(3),
ADD COLUMN     "profilePhotoDocumentId" TEXT;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "applicationCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "applicationSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "currentStatus" "ApplicationStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN     "donDecisionAt" TIMESTAMP(3),
ADD COLUMN     "donReviewStartedAt" TIMESTAMP(3),
ADD COLUMN     "firstUploadAt" TIMESTAMP(3),
ADD COLUMN     "hiredAt" TIMESTAMP(3),
ADD COLUMN     "hrReviewStartedAt" TIMESTAMP(3),
ADD COLUMN     "intakeType" TEXT,
ADD COLUMN     "lastActionAt" TIMESTAMP(3),
ADD COLUMN     "lastActionById" TEXT,
ADD COLUMN     "onboardingStartedAt" TIMESTAMP(3),
ADD COLUMN     "previousStatus" "ApplicationStatus",
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "submittedToDonAt" TIMESTAMP(3),
ADD COLUMN     "verificationCompletedAt" TIMESTAMP(3),
ADD COLUMN     "verificationStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ApplicantProfile_profilePhotoDocumentId_idx" ON "ApplicantProfile"("profilePhotoDocumentId");

-- CreateIndex
CREATE INDEX "ApplicantProfile_identityPhotoStatus_idx" ON "ApplicantProfile"("identityPhotoStatus");

-- CreateIndex
CREATE INDEX "Application_currentStatus_idx" ON "Application"("currentStatus");

-- CreateIndex
CREATE INDEX "Application_applicationCreatedAt_idx" ON "Application"("applicationCreatedAt");

-- CreateIndex
CREATE INDEX "Application_lastActionAt_idx" ON "Application"("lastActionAt");
