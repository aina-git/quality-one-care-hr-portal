/**
 * Advance the demo applicant to a target stage so you can jump straight
 * to seeing HR / Verification / DON / Onboarding views without going through
 * the full applicant flow each time.
 *
 * Usage:
 *   npm run demo:advance -- submitted        # → hr_review_pending (HR sees it in queue)
 *   npm run demo:advance -- hr_review        # → hr_review_started (HR has opened the case)
 *   npm run demo:advance -- approved         # → approved (HR done, verification can start)
 *   npm run demo:advance -- verification     # → verification_in_progress (final checklist created)
 *   npm run demo:advance -- don_ready        # → ready_for_don_review (all checklist items verified)
 *   npm run demo:advance -- don_approved     # → DON approved + onboarding kicked off
 */

import { prisma } from "../lib/prisma";
import { ensureHrReviewQueueForApplication, startHrReviewWorkflow } from "../services/workflow/hrReviewQueueService";
import { updateApplicationLifecycle } from "../services/applicationLifecycleService";
import { ensureFinalVerificationChecklist } from "../services/verification/verificationService";
import { ensureEmployeeOnboarding } from "../services/onboarding/employeeOnboardingService";

const DEMO_EMAIL = "demo.applicant@qualityonecare.local";

async function findDemo() {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { applicant: { include: { applications: { orderBy: { updatedAt: "desc" }, take: 1 } } } }
  });
  if (!user || !user.applicant || !user.applicant.applications[0]) {
    throw new Error("Demo applicant not found. Run `npm run demo:setup` first.");
  }
  return { user, application: user.applicant.applications[0] };
}

async function ensureResume(applicationId: string, applicantProfileId: string) {
  const existing = await prisma.uploadedDocument.findFirst({
    where: { applicationId, documentType: "Resume" }
  });
  if (existing) return;
  await prisma.uploadedDocument.create({
    data: {
      applicantProfileId,
      applicationId,
      documentType: "Resume",
      fileName: "demo-resume.pdf",
      storageKey: "demo/seed-resume",
      processingStatus: "completed",
      detectedDocumentType: "resume",
      extractionConfidence: 0.95
    }
  });
  console.log("Created stub resume document.");
}

async function findHrUser() {
  return prisma.user.findFirst({ where: { role: "hr" } });
}

async function findAdminUser() {
  return prisma.user.findFirst({ where: { role: "admin" } });
}

async function advance(target: string) {
  const { user, application } = await findDemo();
  await ensureResume(application.id, user.applicant!.id);
  const hr = await findHrUser();
  const admin = await findAdminUser();
  const actorId = admin?.id ?? hr?.id ?? user.id;

  switch (target) {
    case "submitted": {
      await updateApplicationLifecycle({
        applicationId: application.id,
        userId: user.id,
        action: "application_submitted",
        patch: {
          status: "hr_review_pending",
          applicationSubmittedAt: new Date()
        },
        details: { source: "demo_advance" }
      });
      await ensureHrReviewQueueForApplication({ applicationId: application.id, userId: user.id, source: "demo_advance" });
      console.log(`✓ Demo applicant advanced to hr_review_pending. HR will see them in /hr/dashboard.`);
      break;
    }
    case "hr_review": {
      // First submit
      await updateApplicationLifecycle({
        applicationId: application.id,
        userId: user.id,
        action: "application_submitted",
        patch: { status: "hr_review_pending", applicationSubmittedAt: new Date() }
      });
      await ensureHrReviewQueueForApplication({ applicationId: application.id, userId: user.id, source: "demo_advance" });
      // Then HR opens it
      if (hr) await startHrReviewWorkflow(application.id, hr.id);
      console.log(`✓ Demo applicant advanced to hr_review_started. HR has the case open.`);
      break;
    }
    case "approved": {
      await updateApplicationLifecycle({
        applicationId: application.id,
        userId: actorId,
        action: "approve_for_onboarding",
        patch: { status: "approved", applicationSubmittedAt: new Date() }
      });
      console.log(`✓ Demo applicant advanced to approved. Verification can now be started.`);
      break;
    }
    case "verification": {
      await updateApplicationLifecycle({
        applicationId: application.id,
        userId: actorId,
        action: "verification_started",
        patch: {
          status: "verification_in_progress",
          applicationSubmittedAt: new Date(),
verificationStartedAt: new Date()
        }
      });
      await ensureFinalVerificationChecklist(application.id, actorId);
      console.log(`✓ Demo applicant advanced to verification_in_progress with checklist created.`);
      break;
    }
    case "don_ready": {
      await updateApplicationLifecycle({
        applicationId: application.id,
        userId: actorId,
        action: "verification_complete",
        patch: {
          status: "ready_for_don_review",
          applicationSubmittedAt: new Date(),
verificationStartedAt: new Date(),
          verificationCompletedAt: new Date()
        }
      });
      const checklist = await ensureFinalVerificationChecklist(application.id, actorId);
      // Mark all required items as verified for the demo
      await prisma.verificationChecklistItem.updateMany({
        where: { checklistId: checklist.id },
        data: { status: "verified", result: "Verified for demo", verifiedAt: new Date(), verifiedByUserId: actorId }
      });
      console.log(`✓ Demo applicant advanced to ready_for_don_review with all checklist items marked verified.`);
      break;
    }
    case "don_approved": {
      await updateApplicationLifecycle({
        applicationId: application.id,
        userId: actorId,
        action: "don_approved",
        patch: {
          status: "approved",
          applicationSubmittedAt: new Date(),
verificationStartedAt: new Date(),
          verificationCompletedAt: new Date(),
          submittedToDonAt: new Date(),
          donDecisionAt: new Date()
        }
      });
      await ensureEmployeeOnboarding(application.id, actorId);
      console.log(`✓ Demo applicant DON-approved + onboarding tasks generated.`);
      break;
    }
    default:
      throw new Error(`Unknown stage: ${target}. Valid: submitted, hr_review, approved, verification, don_ready, don_approved`);
  }
}

const target = process.argv[2] ?? "submitted";
advance(target)
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("Advance failed:", error);
    prisma.$disconnect();
    process.exit(1);
  });
