import type { ApplicationStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { createSystemAlert } from "@/services/alerts/systemAlertService";
import { createNotification } from "@/services/operations/notificationService";

const hrReviewStatuses: ApplicationStatus[] = ["hr_review_pending", "hr_review_started"];
const staffRoles: Role[] = ["hr", "super_admin_hr"];

export function isHrReviewWorkflowStatus(status: ApplicationStatus) {
  return hrReviewStatuses.includes(status);
}

export async function getHrReviewOwner() {
  return prisma.user.findFirst({
    where: { role: { in: staffRoles }, isActive: true },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }]
  });
}

export async function getMissingDocumentCount(applicationId: string) {
  const [blockingDocuments, lowConfidenceDocuments, failedDocuments] = await Promise.all([
    prisma.validationIssue.count({
      where: {
        applicationId,
        resolved: false,
        severity: "blocking",
        section: { contains: "Document", mode: "insensitive" }
      }
    }),
    prisma.validationIssue.count({
      where: {
        applicationId,
        resolved: false,
        issueType: { in: ["missing", "low_confidence", "analysis_failed"] }
      }
    }),
    prisma.uploadedDocument.count({
      where: { applicationId, processingStatus: "failed" }
    })
  ]);
  return Math.max(blockingDocuments, lowConfidenceDocuments) + failedDocuments;
}

export async function ensureHrReviewQueueForApplication({
  applicationId,
  userId,
  source = "workflow_integrity_check"
}: {
  applicationId: string;
  userId?: string | null;
  source?: string;
}) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicantProfile: { include: { user: true } }, hrReviewQueue: true }
  });
  if (!application) throw new Error("Application not found.");
  if (!isHrReviewWorkflowStatus(application.status)) return application.hrReviewQueue;

  const owner = await getHrReviewOwner();
  const applicantName = application.applicantProfile.user.name ?? application.applicantProfile.user.email;
  const route = `/hr/applications/${application.id}/review`;
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let task = await prisma.task.findFirst({
    where: {
      relatedApplicationId: application.id,
      category: "application_review",
      status: { in: ["open", "in_progress", "overdue"] }
    },
    orderBy: { createdAt: "asc" }
  });

  if (!task) {
    task = await prisma.task.create({
      data: {
        title: `Pending HR review: ${applicantName}`,
        description: `Applicant ${applicantName} submitted an application and is waiting for HR review.`,
        category: "application_review",
        priority: "high",
        status: application.status === "hr_review_started" ? "in_progress" : "open",
        dueDate,
        assignedToUserId: owner?.id ?? null,
        createdByUserId: userId ?? null,
        relatedApplicationId: application.id,
        relatedApplicantUserId: application.applicantProfile.userId,
        reminderDateTime: new Date(Date.now() + 60 * 60 * 1000)
      }
    });
    await logAction(userId ?? null, "hr_review_task_created", "task", task.id, {
      applicationId: application.id,
      assignedToUserId: owner?.id ?? null,
      source
    });
  }

  const queue = await prisma.hRReviewQueue.upsert({
    where: { applicationId: application.id },
    update: {
      status: application.status === "hr_review_started" ? "started" : "pending",
      assignedToId: owner?.id ?? application.hrReviewQueue?.assignedToId ?? null,
      taskId: task.id,
      startedAt: application.status === "hr_review_started" ? application.hrReviewStartedAt ?? new Date() : application.hrReviewQueue?.startedAt ?? null,
      lastActivityAt: new Date()
    },
    create: {
      applicationId: application.id,
      status: application.status === "hr_review_started" ? "started" : "pending",
      assignedToId: owner?.id ?? null,
      taskId: task.id,
      startedAt: application.status === "hr_review_started" ? application.hrReviewStartedAt ?? new Date() : null
    }
  });

  await Promise.all(
    staffRoles.map((role) =>
      createSystemAlert({
        category: "hr_review_pending",
        priority: "high",
        title: "Application waiting for HR review",
        message: `${applicantName} submitted an application. Open review to begin HR screening.`,
        route,
        applicationId: application.id,
        targetRole: role,
        dedupeKey: `hr_review_pending:${application.id}:${role}`,
        userIdForAudit: userId ?? null
      })
    )
  );

  const staffUsers = await prisma.user.findMany({
    where: { role: { in: staffRoles }, isActive: true },
    select: { id: true }
  });
  await Promise.all(
    staffUsers.map((staffUser) =>
      createNotification({
        userId: staffUser.id,
        applicationId: application.id,
        notificationType: "task",
        priority: "high",
        title: "Pending HR review",
        body: `${applicantName} submitted an application and needs HR review.`,
        route,
        relatedTaskId: task.id
      })
    )
  );

  await logAction(userId ?? null, application.status === "hr_review_started" ? "hr_review_queue_started" : "hr_review_queue_created", "application", application.id, {
    queueId: queue.id,
    taskId: task.id,
    assignedToUserId: owner?.id ?? null,
    source,
    currentStatus: application.status
  } as Prisma.InputJsonValue);

  return queue;
}

export async function ensureHrReviewWorkflowIntegrity(applicationId: string, userId?: string | null) {
  const application = await prisma.application.findUnique({ where: { id: applicationId }, include: { hrReviewQueue: true } });
  if (!application || !isHrReviewWorkflowStatus(application.status)) return;
  const openTask = await prisma.task.findFirst({
    where: {
      relatedApplicationId: applicationId,
      category: "application_review",
      status: { in: ["open", "in_progress", "overdue"] }
    }
  });
  if (!application.hrReviewQueue || !openTask) {
    await ensureHrReviewQueueForApplication({ applicationId, userId, source: "workflow_integrity_repair" });
  }
}

export async function repairHrReviewWorkflowIntegrity(userId?: string | null) {
  const candidates = await prisma.application.findMany({
    where: {
      OR: [
        { status: { in: ["hr_review_pending", "hr_review_started"] } },
        { status: { in: ["submitted", "resubmitted"] } },
        {
          status: "under_review"
        }
      ]
    },
    select: { id: true, status: true, hrReviewStartedAt: true, applicationSubmittedAt: true, submittedAt: true }
  });

  let repaired = 0;
  for (const application of candidates) {
    if (application.status === "submitted" || application.status === "resubmitted") {
      await prisma.application.update({
        where: { id: application.id },
        data: {
          status: "hr_review_pending",
          currentStatus: "hr_review_pending",
          previousStatus: application.status,
          lastActionAt: new Date(),
          lastActionById: userId ?? undefined
        }
      });
      await prisma.applicationStatusHistory.create({
        data: {
          applicationId: application.id,
          fromStatus: application.status,
          toStatus: "hr_review_pending",
          reason: "workflow_integrity_repair",
          changedById: userId ?? null
        }
      });
      repaired += 1;
    }
    if (application.status === "under_review") {
      await prisma.application.update({
        where: { id: application.id },
        data: {
          status: application.hrReviewStartedAt ? "hr_review_started" : "hr_review_pending",
          currentStatus: application.hrReviewStartedAt ? "hr_review_started" : "hr_review_pending",
          previousStatus: application.status,
          applicationSubmittedAt: application.applicationSubmittedAt ?? application.submittedAt ?? undefined,
          lastActionAt: new Date(),
          lastActionById: userId ?? undefined
        }
      });
      await prisma.applicationStatusHistory.create({
        data: {
          applicationId: application.id,
          fromStatus: application.status,
          toStatus: application.hrReviewStartedAt ? "hr_review_started" : "hr_review_pending",
          reason: "workflow_integrity_repair",
          changedById: userId ?? null
        }
      });
      repaired += 1;
    }
    await ensureHrReviewQueueForApplication({ applicationId: application.id, userId, source: "workflow_integrity_repair" });
  }

  if (repaired) {
    await logAction(userId ?? null, "workflow_integrity_repaired", "application", null, { repairedCount: repaired });
  }
  return { checked: candidates.length, repaired };
}

export async function startHrReviewWorkflow(applicationId: string, userId: string) {
  const now = new Date();
  const current = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!current) throw new Error("Application not found.");
  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: "hr_review_started",
      currentStatus: "hr_review_started",
      previousStatus: current.status,
      hrReviewStartedAt: now,
      lastActionById: userId,
      lastActionAt: now
    }
  });
  await prisma.applicationStatusHistory.create({
    data: {
      applicationId,
      fromStatus: current.status,
      toStatus: "hr_review_started",
      reason: "hr_review_opened",
      changedById: userId
    }
  });
  await ensureHrReviewQueueForApplication({ applicationId, userId, source: "hr_review_opened" });
  await prisma.task.updateMany({
    where: { relatedApplicationId: applicationId, category: "application_review", status: "open" },
    data: { status: "in_progress" }
  });
  await logAction(userId, "hr_review_started", "application", applicationId, {
    fromStatus: current.status,
    toStatus: "hr_review_started"
  });
  return updated;
}
