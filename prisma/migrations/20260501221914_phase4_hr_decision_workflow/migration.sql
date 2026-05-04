-- CreateEnum
CREATE TYPE "HRDecisionAction" AS ENUM ('proceed_to_interview', 'request_clarification', 'place_on_hold', 'mark_not_selected', 'approve_for_onboarding');

-- CreateEnum
CREATE TYPE "MessageSenderRole" AS ENUM ('applicant', 'hr', 'admin', 'system');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('pending', 'scheduled', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "HRDecision" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "action" "HRDecisionAction" NOT NULL,
    "fromStatus" "ApplicationStatus" NOT NULL,
    "toStatus" "ApplicationStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HRDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStatusHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicantMessage" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderRole" "MessageSenderRole" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibleToApplicant" BOOLEAN NOT NULL DEFAULT true,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HRNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HRNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewRecord" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'pending',
    "proposedWindow" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HRDecision_applicationId_idx" ON "HRDecision"("applicationId");

-- CreateIndex
CREATE INDEX "HRDecision_action_idx" ON "HRDecision"("action");

-- CreateIndex
CREATE INDEX "HRDecision_createdById_idx" ON "HRDecision"("createdById");

-- CreateIndex
CREATE INDEX "ApplicationStatusHistory_applicationId_idx" ON "ApplicationStatusHistory"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationStatusHistory_toStatus_idx" ON "ApplicationStatusHistory"("toStatus");

-- CreateIndex
CREATE INDEX "ApplicationStatusHistory_createdAt_idx" ON "ApplicationStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ApplicantMessage_applicationId_idx" ON "ApplicantMessage"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicantMessage_visibleToApplicant_idx" ON "ApplicantMessage"("visibleToApplicant");

-- CreateIndex
CREATE INDEX "ApplicantMessage_createdAt_idx" ON "ApplicantMessage"("createdAt");

-- CreateIndex
CREATE INDEX "HRNote_applicationId_idx" ON "HRNote"("applicationId");

-- CreateIndex
CREATE INDEX "HRNote_createdById_idx" ON "HRNote"("createdById");

-- CreateIndex
CREATE INDEX "InterviewRecord_applicationId_idx" ON "InterviewRecord"("applicationId");

-- CreateIndex
CREATE INDEX "InterviewRecord_status_idx" ON "InterviewRecord"("status");

-- CreateIndex
CREATE INDEX "InterviewRecord_createdById_idx" ON "InterviewRecord"("createdById");

-- AddForeignKey
ALTER TABLE "HRDecision" ADD CONSTRAINT "HRDecision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HRDecision" ADD CONSTRAINT "HRDecision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantMessage" ADD CONSTRAINT "ApplicantMessage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantMessage" ADD CONSTRAINT "ApplicantMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HRNote" ADD CONSTRAINT "HRNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HRNote" ADD CONSTRAINT "HRNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRecord" ADD CONSTRAINT "InterviewRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRecord" ADD CONSTRAINT "InterviewRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
