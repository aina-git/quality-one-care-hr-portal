import type { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { ensureHrReviewWorkflowIntegrity, isHrReviewWorkflowStatus } from "@/services/workflow/hrReviewQueueService";
import { notifyApplicantOfStatusChange } from "@/services/notifications/applicantStatusNotifier";

type LifecyclePatch = {
  status?: ApplicationStatus;
  previousStatus?: ApplicationStatus | null;
  lastActionById?: string | null;
  lastActionAt?: Date;
  firstUploadAt?: Date;
  applicationSubmittedAt?: Date;
  hrReviewStartedAt?: Date;
  verificationStartedAt?: Date;
  verificationCompletedAt?: Date;
  submittedToDonAt?: Date;
  donReviewStartedAt?: Date;
  donDecisionAt?: Date;
  onboardingStartedAt?: Date;
  hiredAt?: Date;
  rejectedAt?: Date;
};

export async function updateApplicationLifecycle({
  applicationId,
  userId,
  action,
  patch,
  details
}: {
  applicationId: string;
  userId?: string | null;
  action: string;
  patch: LifecyclePatch;
  details?: Prisma.InputJsonValue;
}) {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error("Application not found.");
  const now = new Date();
  const nextStatus = patch.status ?? application.status;
  const statusChanged = nextStatus !== application.status;
  const submittedStatuses: ApplicationStatus[] = [
    "submitted",
    "hr_review_pending",
    "hr_review_started",
    "ai_analysis_in_progress",
    "ai_issues_found",
    "ready_for_verification",
    "verification_in_progress",
    "verification_passed",
    "ready_for_don_review",
    "don_review",
    "don_review_started",
    "don_approved",
    "don_rejected",
    "approved",
    "rejected"
  ];
  const inferredSubmittedAt = submittedStatuses.includes(nextStatus)
    ? patch.applicationSubmittedAt ?? application.applicationSubmittedAt ?? application.submittedAt ?? application.firstUploadAt ?? application.applicationCreatedAt
    : undefined;

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: nextStatus,
      currentStatus: nextStatus,
      previousStatus: statusChanged ? application.status : patch.previousStatus === undefined ? application.previousStatus : patch.previousStatus,
      lastActionById: patch.lastActionById === undefined ? userId ?? application.lastActionById : patch.lastActionById,
      lastActionAt: patch.lastActionAt ?? now,
      firstUploadAt: patch.firstUploadAt ?? undefined,
      applicationSubmittedAt: inferredSubmittedAt,
      submittedAt: inferredSubmittedAt,
      hrReviewStartedAt: patch.hrReviewStartedAt ?? undefined,
      verificationStartedAt: patch.verificationStartedAt ?? undefined,
      verificationCompletedAt: patch.verificationCompletedAt ?? undefined,
      submittedToDonAt: patch.submittedToDonAt ?? undefined,
      donReviewStartedAt: patch.donReviewStartedAt ?? undefined,
      donDecisionAt: patch.donDecisionAt ?? undefined,
      onboardingStartedAt: patch.onboardingStartedAt ?? undefined,
      hiredAt: patch.hiredAt ?? undefined,
      rejectedAt: patch.rejectedAt ?? undefined
    }
  });

  if (statusChanged) {
    await prisma.applicationStatusHistory.create({
      data: {
        applicationId,
        fromStatus: application.status,
        toStatus: nextStatus,
        reason: action,
        changedById: userId ?? null
      }
    });
  }

  await logAction(userId ?? null, action, "application", applicationId, {
    ...(typeof details === "object" && details && !Array.isArray(details) ? details : {}),
    fromStatus: application.status,
    toStatus: nextStatus
  } as Prisma.InputJsonValue);

  if (isHrReviewWorkflowStatus(nextStatus)) {
    await ensureHrReviewWorkflowIntegrity(applicationId, userId ?? null);
  }

  // Fire applicant-facing email + SMS notifications when the status actually
  // changed. The notifier swallows its own errors so a bad email config can't
  // break this transaction.
  if (statusChanged) {
    await notifyApplicantOfStatusChange({
      applicationId,
      fromStatus: application.status,
      toStatus: nextStatus,
      triggeredByUserId: userId ?? null
    });
  }

  return updated;
}
