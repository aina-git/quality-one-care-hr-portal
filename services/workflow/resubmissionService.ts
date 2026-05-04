import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";
import { ensureHrReviewQueueForApplication } from "@/services/workflow/hrReviewQueueService";

export async function resubmitAfterCorrection(applicationId: string, userId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicantProfile: true }
  });
  if (!application) throw new Error("Application not found.");
  if (application.applicantProfile.userId !== userId) throw new Error("Application not found.");
  if (application.status !== "correction_requested") {
    throw new Error("Resubmission is only available when corrections are requested.");
  }

  const validation = await validateApplication(applicationId, userId);
  if (!validation.canSubmit) {
    throw new Error("Please resolve blocking validation issues before resubmitting.");
  }

  await updateApplicationLifecycle({
    applicationId,
    userId,
    action: "application_resubmitted_after_correction",
    patch: {
      status: "hr_review_pending",
      applicationSubmittedAt: new Date()
    },
    details: { operationalStatus: "hr_review_pending" }
  });
  await ensureHrReviewQueueForApplication({ applicationId, userId, source: "applicant_resubmission" });
  await prisma.applicantMessage.create({
      data: {
        applicationId,
        senderId: userId,
        senderRole: "applicant",
        subject: "Application resubmitted",
        body: "The applicant has resubmitted the application after corrections.",
        visibleToApplicant: false
      }
    });

  await logAction(userId, "application_resubmitted_after_correction", "application", applicationId);
}
