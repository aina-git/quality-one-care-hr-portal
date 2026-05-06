-- AlterEnum: add a new HR decision action that pushes the application
-- straight into the Verification stage. HR/admin uses this when all
-- documents are in and they want to skip ahead even if some validation
-- issues are still flagged — DON or HR will verify manually downstream.
ALTER TYPE "HRDecisionAction" ADD VALUE IF NOT EXISTS 'send_to_verification';
