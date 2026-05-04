-- CreateEnum
CREATE TYPE "AIReviewStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'moderate', 'high', 'incomplete_review');

-- CreateEnum
CREATE TYPE "ReviewRecommendation" AS ENUM ('proceed_to_interview', 'request_clarification', 'hold_for_review', 'not_recommended_at_this_stage');

-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('pediatric_experience', 'license', 'employment_history', 'document_consistency', 'missing_information', 'certification', 'reference', 'general');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('info', 'warning', 'concern', 'critical');

-- CreateTable
CREATE TABLE "AIReviewReport" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "AIReviewStatus" NOT NULL DEFAULT 'pending',
    "overallRiskLevel" "RiskLevel" NOT NULL DEFAULT 'incomplete_review',
    "recommendation" "ReviewRecommendation" NOT NULL DEFAULT 'hold_for_review',
    "summary" TEXT,
    "strengthsJson" JSONB,
    "concernsJson" JSONB,
    "discrepancyJson" JSONB,
    "pediatricExperienceJson" JSONB,
    "licenseReviewJson" JSONB,
    "employmentReviewJson" JSONB,
    "documentReviewJson" JSONB,
    "hrActionItemsJson" JSONB,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewFinding" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIReviewReport_applicationId_idx" ON "AIReviewReport"("applicationId");

-- CreateIndex
CREATE INDEX "AIReviewReport_status_idx" ON "AIReviewReport"("status");

-- CreateIndex
CREATE INDEX "AIReviewReport_overallRiskLevel_idx" ON "AIReviewReport"("overallRiskLevel");

-- CreateIndex
CREATE INDEX "ReviewFinding_reportId_idx" ON "ReviewFinding"("reportId");

-- CreateIndex
CREATE INDEX "ReviewFinding_applicationId_idx" ON "ReviewFinding"("applicationId");

-- CreateIndex
CREATE INDEX "ReviewFinding_category_idx" ON "ReviewFinding"("category");

-- CreateIndex
CREATE INDEX "ReviewFinding_severity_idx" ON "ReviewFinding"("severity");

-- AddForeignKey
ALTER TABLE "AIReviewReport" ADD CONSTRAINT "AIReviewReport_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFinding" ADD CONSTRAINT "ReviewFinding_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AIReviewReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFinding" ADD CONSTRAINT "ReviewFinding_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
