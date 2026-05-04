-- CreateEnum
CREATE TYPE "EmployeeOnboardingStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('pending', 'completed', 'waived');

-- CreateEnum
CREATE TYPE "TrainingPriority" AS ENUM ('low', 'normal', 'high', 'critical');

-- CreateEnum
CREATE TYPE "TrainingRecommendationStatus" AS ENUM ('recommended', 'assigned', 'completed', 'waived');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'super_admin_hr';
ALTER TYPE "Role" ADD VALUE 'don_approver';
ALTER TYPE "Role" ADD VALUE 'executive_view_only';
ALTER TYPE "Role" ADD VALUE 'scheduler_limited';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "EmployeeOnboarding" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "EmployeeOnboardingStatus" NOT NULL DEFAULT 'in_progress',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTask" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedToId" TEXT,
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecommendation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "trainingTitle" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" "TrainingPriority" NOT NULL DEFAULT 'normal',
    "status" "TrainingRecommendationStatus" NOT NULL DEFAULT 'recommended',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeOnboarding_applicationId_key" ON "EmployeeOnboarding"("applicationId");

-- CreateIndex
CREATE INDEX "EmployeeOnboarding_status_idx" ON "EmployeeOnboarding"("status");

-- CreateIndex
CREATE INDEX "EmployeeOnboarding_startDate_idx" ON "EmployeeOnboarding"("startDate");

-- CreateIndex
CREATE INDEX "OnboardingTask_onboardingId_idx" ON "OnboardingTask"("onboardingId");

-- CreateIndex
CREATE INDEX "OnboardingTask_assignedToId_idx" ON "OnboardingTask"("assignedToId");

-- CreateIndex
CREATE INDEX "OnboardingTask_status_idx" ON "OnboardingTask"("status");

-- CreateIndex
CREATE INDEX "OnboardingTask_dueDate_idx" ON "OnboardingTask"("dueDate");

-- CreateIndex
CREATE INDEX "TrainingRecommendation_applicationId_idx" ON "TrainingRecommendation"("applicationId");

-- CreateIndex
CREATE INDEX "TrainingRecommendation_priority_idx" ON "TrainingRecommendation"("priority");

-- CreateIndex
CREATE INDEX "TrainingRecommendation_status_idx" ON "TrainingRecommendation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRecommendation_applicationId_trainingTitle_key" ON "TrainingRecommendation"("applicationId", "trainingTitle");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- AddForeignKey
ALTER TABLE "EmployeeOnboarding" ADD CONSTRAINT "EmployeeOnboarding_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "EmployeeOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecommendation" ADD CONSTRAINT "TrainingRecommendation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
