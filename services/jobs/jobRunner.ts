import { Prisma } from "@prisma/client";
import type { JobRunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { createSystemAlert, notifyRoleByEmail, resolveApplicationAlertsByCategory } from "@/services/alerts/systemAlertService";
import { generateLicenseAlerts } from "@/services/license/licenseAlertService";
import { processQueuedEmailBatch } from "@/services/notifications/emailService";
import { createApplicantMessageWithEmail } from "@/services/notifications/emailService";
import { renderMessageTemplate } from "@/services/notifications/messageTemplateService";
import { ensureHrReviewQueueForApplication } from "@/services/workflow/hrReviewQueueService";
import { refreshOigDataset } from "@/services/verification/oigService";
import { scanCredentialExpirations } from "@/services/verification/credentialExpirationService";
import { runInterviewReminderScan } from "@/services/interview/interviewReminderService";
import { runExcelCredentialMonitor } from "@/services/excel/excelCredentialMonitorService";

type JobContext = {
  attempt: number;
  startedAt: Date;
};

type JobResult = {
  processedCount: number;
  details?: Record<string, unknown>;
};

type JobDefinition = {
  key: string;
  name: string;
  scheduleLabel: string;
  intervalMinutes: number;
  maxRuntimeSeconds: number;
  maxAttempts: number;
  handler: (context: JobContext) => Promise<JobResult>;
};

const inactivityDraftMs = 3 * 24 * 60 * 60 * 1000;
const inactivityCorrectionMs = 2 * 24 * 60 * 60 * 1000;
const reviewReminderMs = 24 * 60 * 60 * 1000;

function nowPlusMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function formatDateTime(value: Date | null | undefined) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "not available";
}

function toJson(value: Record<string, unknown> | undefined) {
  if (!value) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function runLicenseExpirationScan() {
  const alerts = await generateLicenseAlerts(null);
  return {
    processedCount: alerts.length,
    details: { createdAlerts: alerts.length }
  };
}

async function runOigDatasetRefresh() {
  const result = await refreshOigDataset();
  return {
    processedCount: result.recordCount,
    details: { recordCount: result.recordCount, lastUpdated: result.lastUpdated.toISOString() }
  };
}

async function runCredentialExpirationScan() {
  const result = await scanCredentialExpirations();
  return {
    processedCount: result.certificationAlerts + result.verificationItemAlerts,
    details: { ...result }
  };
}

async function runInterviewReminders() {
  const result = await runInterviewReminderScan();
  return {
    processedCount: result.remindersSent24h + result.remindersSent2h,
    details: { ...result }
  };
}

async function runExcelCredentialMonitorJob() {
  const result = await runExcelCredentialMonitor();
  return {
    processedCount: result.scanned,
    details: result
  };
}

async function runMessageQueueProcessor() {
  const processed = await processQueuedEmailBatch(null, 25);
  return {
    processedCount: processed.processed,
    details: processed
  };
}

async function runApplicationInactivityCheck() {
  const now = new Date();
  const staleDraftCutoff = new Date(now.getTime() - inactivityDraftMs);
  const staleCorrectionCutoff = new Date(now.getTime() - inactivityCorrectionMs);
  const applications = await prisma.application.findMany({
    where: {
      OR: [
        { status: "draft", updatedAt: { lt: staleDraftCutoff } },
        { status: "correction_requested", updatedAt: { lt: staleCorrectionCutoff } }
      ]
    },
    include: {
      applicantProfile: {
        include: {
          user: true
        }
      }
    }
  });

  let remindersSent = 0;
  for (const application of applications) {
    const templateKey = application.status === "draft" ? "draft_inactivity_reminder" : "correction_inactivity_reminder";
    const recentReminder = await prisma.applicantMessage.findFirst({
      where: {
        applicationId: application.id,
        templateKey,
        createdAt: {
          gt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
        }
      }
    });
    if (recentReminder) continue;

    const template = await renderMessageTemplate(templateKey, {
      lastUpdatedAt: formatDateTime(application.updatedAt)
    });
    await createApplicantMessageWithEmail({
      applicationId: application.id,
      senderRole: "system",
      templateKey: template.templateKey,
      subject: template.subject,
      body: template.body,
      userIdForAudit: null
    });
    await logAction(null, "application_inactivity_reminder_sent", "application", application.id, {
      status: application.status,
      applicantEmail: application.applicantProfile.user.email
    });
    remindersSent += 1;
  }

  return {
    processedCount: remindersSent,
    details: {
      matchedApplications: applications.length,
      remindersSent
    }
  };
}

async function runPendingReviewReminder() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - reviewReminderMs);
  const applications = await prisma.application.findMany({
    where: {
      status: "hr_review_pending",
      applicationSubmittedAt: { lt: cutoff }
    },
    include: {
      applicantProfile: {
        include: {
          user: true
        }
      },
      aiReviewReports: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  let alertsCreated = 0;
  for (const application of applications) {
    const latestReport = application.aiReviewReports[0];
    await ensureHrReviewQueueForApplication({ applicationId: application.id, source: "pending_review_reminder" });
    if (latestReport?.status === "completed") {
      await resolveApplicationAlertsByCategory("pending_review", application.id, null);
      continue;
    }

    const template = await renderMessageTemplate("pending_hr_review", {
      applicantName: application.applicantProfile.user.name ?? application.applicantProfile.user.email,
      submittedAt: formatDateTime(application.applicationSubmittedAt ?? application.submittedAt)
    });
    await createSystemAlert({
      category: "pending_review",
      priority: "high",
      title: "Submitted application awaiting review",
      message: template.body,
      route: `/hr/applications/${application.id}/review`,
      applicationId: application.id,
      targetRole: "hr",
      dedupeKey: `pending-review:${application.id}`,
      userIdForAudit: null
    });
    await notifyRoleByEmail({
      role: "hr",
      subject: template.subject,
      body: template.body,
      applicationId: application.id,
      userIdForAudit: null
    });
    await logAction(null, "pending_review_reminder_sent", "application", application.id, {
      submittedAt: (application.applicationSubmittedAt ?? application.submittedAt)?.toISOString() ?? null
    });
    alertsCreated += 1;
  }

  return {
    processedCount: alertsCreated,
    details: {
      matchedApplications: applications.length,
      alertsCreated
    }
  };
}

async function runStaleAnalysisRecovery() {
  const staleThresholdMs = 10 * 60 * 1000;
  const staleApps = await prisma.application.findMany({
    where: {
      status: "ai_analysis_in_progress",
      lastActionAt: { lt: new Date(Date.now() - staleThresholdMs) }
    },
    select: { id: true }
  });
  for (const app of staleApps) {
    await prisma.application.update({
      where: { id: app.id },
      data: { status: "ai_issues_found", currentStatus: "ai_issues_found", lastActionAt: new Date() }
    });
    await createSystemAlert({
      category: "system",
      priority: "high",
      title: "Stuck AI analysis recovered",
      message: `Application ${app.id} was stuck in ai_analysis_in_progress for >10 minutes and was automatically moved to ai_issues_found.`,
      applicationId: app.id,
      targetRole: "admin"
    });
  }
  return { processedCount: staleApps.length, details: { recovered: staleApps.length } };
}

const jobs: JobDefinition[] = [
  {
    key: "stale_analysis_recovery",
    name: "Stale AI Analysis Recovery",
    scheduleLabel: "Every 5 minutes",
    intervalMinutes: 5,
    maxRuntimeSeconds: 60,
    maxAttempts: 2,
    handler: runStaleAnalysisRecovery
  },
  {
    key: "license_expiration_scan",
    name: "License Expiration Scan",
    scheduleLabel: "Daily",
    intervalMinutes: 24 * 60,
    maxRuntimeSeconds: 300,
    maxAttempts: 2,
    handler: runLicenseExpirationScan
  },
  {
    key: "message_queue_processor",
    name: "Message Queue Processor",
    scheduleLabel: "Every 5 minutes",
    intervalMinutes: 5,
    maxRuntimeSeconds: 300,
    maxAttempts: 3,
    handler: runMessageQueueProcessor
  },
  {
    key: "application_inactivity_checker",
    name: "Application Inactivity Checker",
    scheduleLabel: "Daily",
    intervalMinutes: 24 * 60,
    maxRuntimeSeconds: 300,
    maxAttempts: 2,
    handler: runApplicationInactivityCheck
  },
  {
    key: "pending_review_reminder",
    name: "Pending Review Reminder",
    scheduleLabel: "Daily",
    intervalMinutes: 24 * 60,
    maxRuntimeSeconds: 300,
    maxAttempts: 2,
    handler: runPendingReviewReminder
  },
  {
    key: "oig_dataset_refresh",
    name: "OIG LEIE Dataset Refresh",
    scheduleLabel: "Daily",
    intervalMinutes: 24 * 60,
    maxRuntimeSeconds: 600,
    maxAttempts: 3,
    handler: runOigDatasetRefresh
  },
  {
    key: "credential_expiration_scan",
    name: "Credential Expiration Scan",
    scheduleLabel: "Daily",
    intervalMinutes: 24 * 60,
    maxRuntimeSeconds: 300,
    maxAttempts: 2,
    handler: runCredentialExpirationScan
  },
  {
    key: "interview_reminders",
    name: "Interview Reminder Sender",
    scheduleLabel: "Hourly",
    intervalMinutes: 60,
    maxRuntimeSeconds: 180,
    maxAttempts: 2,
    handler: runInterviewReminders
  },
  {
    key: "excel_credential_monitor",
    name: "Excel Credential Monitor",
    scheduleLabel: "Hourly",
    intervalMinutes: 60,
    maxRuntimeSeconds: 300,
    maxAttempts: 2,
    handler: runExcelCredentialMonitorJob
  }
];

const globalForJobs = globalThis as unknown as {
  qocJobRunnerStarted?: boolean;
  qocJobRunnerTimer?: NodeJS.Timeout;
};

export async function ensureJobDefinitions() {
  for (const job of jobs) {
    await prisma.jobDefinition.upsert({
      where: { key: job.key },
      update: {
        name: job.name,
        scheduleLabel: job.scheduleLabel,
        intervalMinutes: job.intervalMinutes,
        maxRuntimeSeconds: job.maxRuntimeSeconds
      },
      create: {
        key: job.key,
        name: job.name,
        scheduleLabel: job.scheduleLabel,
        intervalMinutes: job.intervalMinutes,
        maxRuntimeSeconds: job.maxRuntimeSeconds,
        nextRunAt: new Date()
      }
    });
  }
}

async function acquireJob(job: JobDefinition) {
  const now = new Date();
  const lockId = globalThis.crypto?.randomUUID?.() ?? `${job.key}-${Date.now()}`;
  const updated = await prisma.jobDefinition.updateMany({
    where: {
      key: job.key,
      enabled: true,
      AND: [
        {
          OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lt: now } }]
        },
        {
          OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }]
        }
      ]
    },
    data: {
      lockId,
      lockExpiresAt: new Date(now.getTime() + job.maxRuntimeSeconds * 1000),
      lastStartedAt: now,
      lastStatus: "running",
      lastError: null,
      nextRunAt: nowPlusMinutes(job.intervalMinutes)
    }
  });

  if (updated.count === 0) return null;
  return { lockId, startedAt: now };
}

async function completeJob(job: JobDefinition, lockId: string, status: JobRunStatus, errorMessage: string | null, completedAt: Date) {
  const data =
    status === "succeeded"
      ? {
          lockId: null,
          lockExpiresAt: null,
          lastCompletedAt: completedAt,
          lastSucceededAt: completedAt,
          lastStatus: status,
          lastError: null
        }
      : {
          lockId: null,
          lockExpiresAt: null,
          lastCompletedAt: completedAt,
          lastFailedAt: completedAt,
          lastStatus: status,
          lastError: errorMessage
        };

  await prisma.jobDefinition.updateMany({
    where: {
      key: job.key,
      lockId
    },
    data
  });
}

async function executeJob(job: JobDefinition) {
  const lock = await acquireJob(job);
  if (!lock) return null;

  const run = await prisma.jobRun.create({
    data: {
      jobKey: job.key,
      status: "running",
      attempt: 1,
      startedAt: lock.startedAt
    }
  });

  for (let attempt = 1; attempt <= job.maxAttempts; attempt += 1) {
    try {
      const result = await job.handler({
        attempt,
        startedAt: lock.startedAt
      });
      const completedAt = new Date();
      await prisma.jobRun.update({
        where: { id: run.id },
        data: {
          status: "succeeded",
          attempt,
          completedAt,
          durationMs: completedAt.getTime() - lock.startedAt.getTime(),
          processedCount: result.processedCount,
          detailsJson: toJson(result.details)
        }
      });
      await completeJob(job, lock.lockId, "succeeded", null, completedAt);
      await logAction(null, "job_execution_completed", "job", job.key, {
        runId: run.id,
        attempt,
        processedCount: result.processedCount
      });
      return {
        key: job.key,
        status: "succeeded" as const,
        processedCount: result.processedCount
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job execution failed.";
      if (attempt < job.maxAttempts) {
        await prisma.jobRun.update({
          where: { id: run.id },
          data: {
            attempt,
            errorMessage: message
          }
        });
        continue;
      }

      const completedAt = new Date();
      await prisma.jobRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          attempt,
          completedAt,
          durationMs: completedAt.getTime() - lock.startedAt.getTime(),
          errorMessage: message
        }
      });
      await completeJob(job, lock.lockId, "failed", message, completedAt);
      await logAction(null, "job_execution_failed", "job", job.key, {
        runId: run.id,
        attempt,
        errorMessage: message
      });
      return {
        key: job.key,
        status: "failed" as const,
        errorMessage: message
      };
    }
  }

  return null;
}

export async function runDueJobs() {
  await ensureJobDefinitions();
  const results = [];
  for (const job of jobs) {
    const result = await executeJob(job);
    if (result) results.push(result);
  }
  return results;
}

export async function runJobNow(jobKey: string) {
  await ensureJobDefinitions();
  const job = jobs.find((entry) => entry.key === jobKey);
  if (!job) {
    throw new Error("Job definition not found.");
  }

  await prisma.jobDefinition.update({
    where: { key: job.key },
    data: {
      nextRunAt: new Date(0),
      lockId: null,
      lockExpiresAt: null
    }
  });
  const result = await executeJob(job);
  if (!result) {
    throw new Error("Job could not start.");
  }
  return result;
}

export function startJobRunner() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if ((process.env.JOB_RUNNER_ENABLED ?? "true").toLowerCase() === "false") return;
  if (globalForJobs.qocJobRunnerStarted) return;

  globalForJobs.qocJobRunnerStarted = true;
  const pollSeconds = Number.parseInt(process.env.JOB_RUNNER_POLL_SECONDS ?? "60", 10);
  const pollMs = Number.isFinite(pollSeconds) && pollSeconds > 0 ? pollSeconds * 1000 : 60 * 1000;

  void runDueJobs().catch((error) => {
    console.error("Quality One Care job runner startup tick failed.", error);
  });

  globalForJobs.qocJobRunnerTimer = setInterval(() => {
    void runDueJobs().catch((error) => {
      console.error("Quality One Care job runner tick failed.", error);
    });
  }, pollMs);
}
