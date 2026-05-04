-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'application_uploaded';
ALTER TYPE "ApplicationStatus" ADD VALUE 'intake_review_started';
ALTER TYPE "ApplicationStatus" ADD VALUE 'applicant_correction_required';
ALTER TYPE "ApplicationStatus" ADD VALUE 'resubmitted';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ai_analysis_in_progress';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ai_issues_found';
ALTER TYPE "ApplicationStatus" ADD VALUE 'applicant_response_required';
ALTER TYPE "ApplicationStatus" ADD VALUE 'hr_resolution_required';
ALTER TYPE "ApplicationStatus" ADD VALUE 'ready_for_verification';
ALTER TYPE "ApplicationStatus" ADD VALUE 'verification_issues_found';
ALTER TYPE "ApplicationStatus" ADD VALUE 'verification_passed';
ALTER TYPE "ApplicationStatus" ADD VALUE 'don_review_started';
ALTER TYPE "ApplicationStatus" ADD VALUE 'don_approved';
ALTER TYPE "ApplicationStatus" ADD VALUE 'don_rejected';
ALTER TYPE "ApplicationStatus" ADD VALUE 'more_information_required';
ALTER TYPE "ApplicationStatus" ADD VALUE 'final_outcome_sent';
ALTER TYPE "ApplicationStatus" ADD VALUE 'completed';
