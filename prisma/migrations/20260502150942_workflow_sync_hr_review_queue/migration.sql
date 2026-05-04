-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'hr_review_pending';
ALTER TYPE "ApplicationStatus" ADD VALUE 'hr_review_started';
ALTER TYPE "ApplicationStatus" ADD VALUE 'verification_pending';
ALTER TYPE "ApplicationStatus" ADD VALUE 'verification_in_progress';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ready_for_don_review';
ALTER TYPE "ApplicationStatus" ADD VALUE 'don_review';

-- CreateTable
CREATE TABLE "HRReviewQueue" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assignedToId" TEXT,
    "taskId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HRReviewQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HRReviewQueue_applicationId_key" ON "HRReviewQueue"("applicationId");

-- CreateIndex
CREATE INDEX "HRReviewQueue_status_idx" ON "HRReviewQueue"("status");

-- CreateIndex
CREATE INDEX "HRReviewQueue_assignedToId_idx" ON "HRReviewQueue"("assignedToId");

-- CreateIndex
CREATE INDEX "HRReviewQueue_lastActivityAt_idx" ON "HRReviewQueue"("lastActivityAt");

-- AddForeignKey
ALTER TABLE "HRReviewQueue" ADD CONSTRAINT "HRReviewQueue_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
