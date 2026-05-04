-- CreateEnum
CREATE TYPE "AlertPriority" AS ENUM ('critical', 'high', 'normal');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'skipped');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LicenseAlertType" ADD VALUE 'expiring_30_days';
ALTER TYPE "LicenseAlertType" ADD VALUE 'expiring_7_days';

-- AlterTable
ALTER TABLE "ApplicantMessage" ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LicenseAlert" ADD COLUMN     "lastNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "priority" "AlertPriority" NOT NULL DEFAULT 'normal';

-- CreateTable
CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "category" TEXT NOT NULL,
    "priority" "AlertPriority" NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "route" TEXT,
    "targetRole" "Role",
    "dedupeKey" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDefinition" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduleLabel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER NOT NULL,
    "maxRuntimeSeconds" INTEGER NOT NULL DEFAULT 300,
    "lastStartedAt" TIMESTAMP(3),
    "lastCompletedAt" TIMESTAMP(3),
    "lastSucceededAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "lastStatus" "JobRunStatus" NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "nextRunAt" TIMESTAMP(3),
    "lockId" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDefinition_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "processedCount" INTEGER,
    "errorMessage" TEXT,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemAlert_dedupeKey_key" ON "SystemAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "SystemAlert_targetRole_resolved_createdAt_idx" ON "SystemAlert"("targetRole", "resolved", "createdAt");

-- CreateIndex
CREATE INDEX "SystemAlert_applicationId_resolved_idx" ON "SystemAlert"("applicationId", "resolved");

-- CreateIndex
CREATE INDEX "SystemAlert_priority_resolved_createdAt_idx" ON "SystemAlert"("priority", "resolved", "createdAt");

-- CreateIndex
CREATE INDEX "JobDefinition_enabled_nextRunAt_idx" ON "JobDefinition"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "JobDefinition_lastStatus_updatedAt_idx" ON "JobDefinition"("lastStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "JobRun_jobKey_createdAt_idx" ON "JobRun"("jobKey", "createdAt");

-- CreateIndex
CREATE INDEX "JobRun_status_createdAt_idx" ON "JobRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicantMessage_retryCount_lastAttemptAt_idx" ON "ApplicantMessage"("retryCount", "lastAttemptAt");

-- CreateIndex
CREATE INDEX "Application_status_submittedAt_idx" ON "Application"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Application_updatedAt_idx" ON "Application"("updatedAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "EmailQueue_status_attempts_idx" ON "EmailQueue"("status", "attempts");

-- CreateIndex
CREATE INDEX "LicenseAlert_priority_resolved_idx" ON "LicenseAlert"("priority", "resolved");

-- AddForeignKey
ALTER TABLE "SystemAlert" ADD CONSTRAINT "SystemAlert_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_jobKey_fkey" FOREIGN KEY ("jobKey") REFERENCES "JobDefinition"("key") ON DELETE CASCADE ON UPDATE CASCADE;
