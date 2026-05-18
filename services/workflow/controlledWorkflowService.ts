import type { ApplicationStatus, Prisma, Role, TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendCommunication } from "@/services/communications/communicationService";
import { createNotification } from "@/services/operations/notificationService";
import { createSystemAlert } from "@/services/alerts/systemAlertService";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";
import { ensureHrReviewQueueForApplication } from "@/services/workflow/hrReviewQueueService";

type ControlledTransitionInput = {
  applicationId: string;
  userId?: string | null;
  status: ApplicationStatus;
  action: string;
  note?: string;
  details?: Prisma.InputJsonValue;
  notifyApplicant?: boolean;
  notifyStaff?: boolean;
  createTask?: boolean;
  taskTitle?: string;
  taskDescription?: string;
  taskPriority?: TaskPriority;
};

const staffRoles: Role[] = ["super_admin_hr", "hr"];
const applicantActionStatuses: ApplicationStatus[] = [
  "applicant_correction_required",
  "applicant_response_required",
  "more_information_required",
  "correction_requested"
];
const hrQueueStatuses: ApplicationStatus[] = ["hr_review_pending", "hr_review_started"];

export function isApplicantActionStatus(status: ApplicationStatus) {
  return applicantActionStatuses.includes(status);
}

export function isControlledTerminalStatus(status: ApplicationStatus) {
  return ["completed", "archived", "don_rejected", "rejected", "final_not_approved"].includes(status);
}

export async function transitionApplication({
  applicationId,
  userId,
  status,
  action,
  note,
  details,
  notifyApplicant = false,
  notifyStaff = true,
  createTask = true,
  taskTitle,
  taskDescription,
  taskPriority = "high"
}: ControlledTransitionInput) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicantProfile: { include: { user: true } } }
  });
  if (!application) throw new Error("Application not found.");

  const now = new Date();
  const patch: Parameters<typeof updateApplicationLifecycle>[0]["patch"] = { status };
  if (status === "application_uploaded" && !application.firstUploadAt) patch.firstUploadAt = now;
  if (status === "hr_review_started" && !application.hrReviewStartedAt) patch.hrReviewStartedAt = now;
  if (status === "verification_in_progress" && !application.verificationStartedAt) patch.verificationStartedAt = now;
  if (status === "verification_passed" && !application.verificationCompletedAt) patch.verificationCompletedAt = now;
  if ((status === "ready_for_don_review" || status === "don_review_started") && !application.submittedToDonAt) patch.submittedToDonAt = now;
  if (status === "don_review_started" && !application.donReviewStartedAt) patch.donReviewStartedAt = now;
  if (["don_approved", "don_rejected", "more_information_required"].includes(status)) patch.donDecisionAt = now;
  if (status === "don_approved") patch.hiredAt = now;
  if (status === "don_rejected" || status === "rejected" || status === "final_not_approved") patch.rejectedAt = now;

  const updated = await updateApplicationLifecycle({
    applicationId,
    userId,
    action,
    patch,
    details: {
      ...(typeof details === "object" && details && !Array.isArray(details) ? details : {}),
      note,
      controlledWorkflow: true
    } as Prisma.InputJsonValue
  });

  const route = `/admin/applications/${applicationId}/review`;
  const applicantName = application.applicantProfile.user.name ?? application.applicantProfile.user.email;

  if (hrQueueStatuses.includes(status)) {
    await ensureHrReviewQueueForApplication({ applicationId, userId, source: action });
  }

  if (createTask && !isControlledTerminalStatus(status)) {
    const assignee = await prisma.user.findFirst({
      where: { role: { in: staffRoles }, isActive: true },
      orderBy: [{ role: "desc" }, { createdAt: "asc" }]
    });
    await prisma.task.create({
      data: {
        title: taskTitle ?? `${applicantName}: ${status.replace(/_/g, " ")}`,
        description: taskDescription ?? note ?? `Workflow moved to ${status.replace(/_/g, " ")}.`,
        category: status.includes("verification") ? "verification" : status.includes("don") ? "application_review" : "application_review",
        priority: taskPriority,
        status: "open",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        assignedToUserId: assignee?.id ?? null,
        createdByUserId: userId ?? null,
        relatedApplicationId: applicationId,
        relatedApplicantUserId: application.applicantProfile.userId
      }
    });
  }

  if (notifyStaff) {
    await Promise.all(
      staffRoles.map((role) =>
        createSystemAlert({
          category: `workflow_${status}`,
          priority: status.includes("issues") || status.includes("required") ? "high" : "normal",
          title: `${applicantName}: ${status.replace(/_/g, " ")}`,
          message: note ?? `Application moved to ${status.replace(/_/g, " ")}.`,
          route,
          applicationId,
          targetRole: role,
          dedupeKey: `workflow:${applicationId}:${status}:${role}`,
          userIdForAudit: userId ?? null
        })
      )
    );

    const staffUsers = await prisma.user.findMany({ where: { role: { in: staffRoles }, isActive: true }, select: { id: true } });
    await Promise.all(
      staffUsers.map((staffUser) =>
        createNotification({
          userId: staffUser.id,
          applicationId,
          notificationType: "system_alert",
          priority: status.includes("issues") || status.includes("required") ? "high" : "normal",
          title: `${applicantName}: ${status.replace(/_/g, " ")}`,
          body: note ?? `Application moved to ${status.replace(/_/g, " ")}.`,
          route
        })
      )
    );
  }

  if (notifyApplicant || isApplicantActionStatus(status)) {
    await sendCommunication({
      applicationId,
      senderId: userId ?? application.applicantProfile.userId,
      senderRole: userId ? "super_admin_hr" : "system",
      channel: "in_app",
      subject: "Action needed on your Quality One Care application",
      body: note ?? "Please review your application portal for the next required action.",
      visibleToApplicant: true
    });
  }

  return updated;
}
