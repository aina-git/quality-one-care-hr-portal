-- CreateEnum
CREATE TYPE "EmailQueueStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "OnboardingChecklistStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "OnboardingItemStatus" AS ENUM ('pending', 'completed', 'waived');

-- CreateEnum
CREATE TYPE "LicenseAlertType" AS ENUM ('expired', 'expiring_soon');

-- AlterTable
ALTER TABLE "ApplicantMessage" ADD COLUMN     "templateKey" TEXT;

-- AlterTable
ALTER TABLE "InterviewRecord" ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "EmailQueue" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "applicantMessageId" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provider" TEXT,
    "status" "EmailQueueStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingChecklist" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "OnboardingChecklistStatus" NOT NULL DEFAULT 'not_started',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "OnboardingItemStatus" NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseAlert" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "alertType" "LicenseAlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailQueue_applicationId_idx" ON "EmailQueue"("applicationId");

-- CreateIndex
CREATE INDEX "EmailQueue_status_idx" ON "EmailQueue"("status");

-- CreateIndex
CREATE INDEX "EmailQueue_queuedAt_idx" ON "EmailQueue"("queuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_key_key" ON "MessageTemplate"("key");

-- CreateIndex
CREATE INDEX "MessageTemplate_category_idx" ON "MessageTemplate"("category");

-- CreateIndex
CREATE INDEX "MessageTemplate_active_idx" ON "MessageTemplate"("active");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingChecklist_applicationId_key" ON "OnboardingChecklist"("applicationId");

-- CreateIndex
CREATE INDEX "OnboardingChecklist_status_idx" ON "OnboardingChecklist"("status");

-- CreateIndex
CREATE INDEX "OnboardingItem_checklistId_idx" ON "OnboardingItem"("checklistId");

-- CreateIndex
CREATE INDEX "OnboardingItem_status_idx" ON "OnboardingItem"("status");

-- CreateIndex
CREATE INDEX "LicenseAlert_applicationId_idx" ON "LicenseAlert"("applicationId");

-- CreateIndex
CREATE INDEX "LicenseAlert_alertType_idx" ON "LicenseAlert"("alertType");

-- CreateIndex
CREATE INDEX "LicenseAlert_resolved_idx" ON "LicenseAlert"("resolved");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseAlert_licenseId_alertType_key" ON "LicenseAlert"("licenseId", "alertType");

-- CreateIndex
CREATE INDEX "ApplicantMessage_templateKey_idx" ON "ApplicantMessage"("templateKey");

-- AddForeignKey
ALTER TABLE "EmailQueue" ADD CONSTRAINT "EmailQueue_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "OnboardingChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingItem" ADD CONSTRAINT "OnboardingItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseAlert" ADD CONSTRAINT "LicenseAlert_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseAlert" ADD CONSTRAINT "LicenseAlert_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;
