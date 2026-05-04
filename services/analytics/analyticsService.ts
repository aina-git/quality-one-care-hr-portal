import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/env";
import { ensureJobDefinitions } from "@/services/jobs/jobRunner";

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function asObject(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getJsonString(value: unknown, key: string) {
  const record = asObject(value);
  const entry = record[key];
  return typeof entry === "string" ? entry : null;
}

function normalizeReason(note: string) {
  const normalized = note.replace(/\s+/g, " ").trim();
  if (!normalized) return "No reason provided";
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

export async function getPipelineAnalytics() {
  const grouped = await prisma.application.groupBy({
    by: ["status"],
    _count: { _all: true }
  });
  const counts: Record<string, number> = {};
  for (const row of grouped) counts[row.status] = row._count._all;

  const funnel = [
    { stage: "Draft", count: counts["draft"] ?? 0 },
    { stage: "Submitted", count: (counts["submitted"] ?? 0) + (counts["resubmitted"] ?? 0) + (counts["intake_review_started"] ?? 0) },
    { stage: "HR Review", count: (counts["hr_review_pending"] ?? 0) + (counts["hr_review_started"] ?? 0) + (counts["under_review"] ?? 0) },
    { stage: "Verification", count: (counts["ready_for_verification"] ?? 0) + (counts["verification_pending"] ?? 0) + (counts["verification_in_progress"] ?? 0) + (counts["verification_passed"] ?? 0) },
    { stage: "DON Review", count: (counts["ready_for_don_review"] ?? 0) + (counts["don_review"] ?? 0) + (counts["don_review_started"] ?? 0) },
    { stage: "Approved", count: (counts["don_approved"] ?? 0) + (counts["approved"] ?? 0) },
    { stage: "Rejected", count: (counts["rejected"] ?? 0) + (counts["don_rejected"] ?? 0) + (counts["final_not_approved"] ?? 0) }
  ];

  const now = Date.now();
  const stuckApplications = await prisma.application.findMany({
    where: {
      status: { notIn: ["draft", "completed", "archived", "approved", "don_approved", "rejected", "don_rejected"] },
      lastActionAt: { lt: new Date(now - 2 * 24 * 60 * 60 * 1000) }
    },
    include: { applicantProfile: { include: { user: true } } },
    orderBy: { lastActionAt: "asc" },
    take: 10
  });
  const stuckList = stuckApplications.map((app) => ({
    id: app.id,
    name: app.applicantProfile.user.name ?? app.applicantProfile.user.email,
    status: app.status,
    daysStuck: Math.floor((now - (app.lastActionAt ?? app.updatedAt).getTime()) / (24 * 60 * 60 * 1000))
  }));

  const stuckByStage = new Map<string, number>();
  for (const item of stuckList) {
    const k = item.status;
    stuckByStage.set(k, (stuckByStage.get(k) ?? 0) + 1);
  }

  return { funnel, statusCounts: counts, stuckList, stuckByStage: Array.from(stuckByStage.entries()).map(([status, count]) => ({ status, count })) };
}

export async function getLicenseExpirationCalendar() {
  const now = Date.now();
  const horizon = new Date(now + 90 * 24 * 60 * 60 * 1000);
  const items = await prisma.license.findMany({
    where: {
      expiresAt: { not: null, lte: horizon },
      applicationId: { not: null },
      application: { status: { not: "draft" } }
    },
    include: { application: { include: { applicantProfile: { include: { user: true } } } } },
    orderBy: { expiresAt: "asc" }
  });
  return items.map((lic) => ({
    licenseId: lic.id,
    type: lic.type,
    licenseNumber: lic.licenseNumber,
    expiresAt: lic.expiresAt,
    daysUntil: lic.expiresAt ? Math.ceil((lic.expiresAt.getTime() - now) / (24 * 60 * 60 * 1000)) : null,
    applicationId: lic.applicationId,
    applicantName: lic.application?.applicantProfile.user.name ?? lic.application?.applicantProfile.user.email ?? "—"
  }));
}

export async function getAdminAnalyticsData() {
  const applications = await prisma.application.findMany({
    where: { status: { not: "draft" } },
    include: {
      interviewRecords: true,
      decisions: {
        orderBy: { createdAt: "asc" }
      }
    }
  });
  const interviews = await prisma.interviewRecord.findMany({
    where: { status: { not: "cancelled" } }
  });
  const decisions = await prisma.hRDecision.findMany({
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      }
    }
  });
  const licenses = await prisma.license.findMany({
    where: {
      applicationId: { not: null },
      expiresAt: { not: null }
    }
  });
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ["ai_review_started", "ai_review_rerun", "ai_review_completed"]
      }
    },
    orderBy: { createdAt: "asc" }
  });
  const hrUsers = await prisma.user.findMany({
    where: { role: { in: ["hr", "admin"] } },
    select: { id: true, email: true, name: true, role: true }
  });

  const submittedApplications = applications.filter((application) => Boolean(application.submittedAt));
  const interviewApplicationIds = new Set(interviews.map((interview) => interview.applicationId));
  const approvedInterviewIds = new Set(
    applications
      .filter((application) => application.status === "approved" && application.interviewRecords.some((interview) => interview.status !== "cancelled"))
      .map((application) => application.id)
  );

  const firstDecisionDurations = applications
    .map((application) => {
      const firstDecision = application.decisions[0];
      if (!application.submittedAt || !firstDecision) return null;
      return firstDecision.createdAt.getTime() - application.submittedAt.getTime();
    })
    .filter((value): value is number => value !== null);

  const averageTimeToDecisionDays = firstDecisionDurations.length
    ? Math.round((firstDecisionDurations.reduce((sum, value) => sum + value, 0) / firstDecisionDurations.length / (24 * 60 * 60 * 1000)) * 10) / 10
    : 0;

  const rejectionReasonMap = new Map<string, number>();
  for (const decision of decisions) {
    if (decision.action !== "mark_not_selected") continue;
    const key = normalizeReason(decision.note);
    rejectionReasonMap.set(key, (rejectionReasonMap.get(key) ?? 0) + 1);
  }
  const rejectionReasons = Array.from(rejectionReasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  const now = Date.now();
  const sevenDays = now + 7 * 24 * 60 * 60 * 1000;
  const thirtyDays = now + 30 * 24 * 60 * 60 * 1000;
  const licenseTrends = {
    expired: licenses.filter((license) => license.expiresAt && license.expiresAt.getTime() < now).length,
    expiring7Days: licenses.filter((license) => {
      const expiresAt = license.expiresAt?.getTime();
      return expiresAt ? expiresAt >= now && expiresAt <= sevenDays : false;
    }).length,
    expiring30Days: licenses.filter((license) => {
      const expiresAt = license.expiresAt?.getTime();
      return expiresAt ? expiresAt > sevenDays && expiresAt <= thirtyDays : false;
    }).length,
    active: licenses.filter((license) => {
      const expiresAt = license.expiresAt?.getTime();
      return expiresAt ? expiresAt > thirtyDays : false;
    }).length
  };

  const reviewEvents = new Map<string, { userId: string; startedAt?: Date; completedAt?: Date }>();
  for (const log of auditLogs) {
    const reportId = getJsonString(log.details, "reportId");
    if (!reportId || !log.userId) continue;
    const existing = reviewEvents.get(reportId) ?? { userId: log.userId };
    if (log.action === "ai_review_started" || log.action === "ai_review_rerun") {
      existing.startedAt = log.createdAt;
      existing.userId = log.userId;
    }
    if (log.action === "ai_review_completed") {
      existing.completedAt = log.createdAt;
      existing.userId = log.userId;
    }
    reviewEvents.set(reportId, existing);
  }

  const decisionCounts = new Map<string, number>();
  for (const decision of decisions) {
    decisionCounts.set(decision.createdById, (decisionCounts.get(decision.createdById) ?? 0) + 1);
  }

  const hrPerformance = hrUsers.map((user) => {
    const completedReviews = Array.from(reviewEvents.values()).filter((event) => event.userId === user.id && event.completedAt);
    const durations = completedReviews
      .map((event) => {
        if (!event.startedAt || !event.completedAt) return null;
        return event.completedAt.getTime() - event.startedAt.getTime();
      })
      .filter((value): value is number => value !== null);
    const averageReviewHours = durations.length
      ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length / (60 * 60 * 1000)) * 10) / 10
      : 0;

    return {
      id: user.id,
      name: user.name ?? user.email,
      role: user.role,
      reviewsCompleted: completedReviews.length,
      averageReviewHours,
      decisionsMade: decisionCounts.get(user.id) ?? 0
    };
  });

  return {
    totals: {
      applications: applications.length,
      submittedToInterviewRate: percent(interviewApplicationIds.size, submittedApplications.length),
      interviewToApprovedRate: percent(approvedInterviewIds.size, interviewApplicationIds.size),
      averageTimeToDecisionDays
    },
    rejectionReasons,
    licenseTrends,
    hrPerformance
  };
}

async function getLocalStorageUsage() {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const target = path.join(process.cwd(), "storage", "protected");

  async function walk(directory: string): Promise<{ fileCount: number; totalBytes: number }> {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    let totalBytes = 0;
    let fileCount = 0;

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const nested = await walk(fullPath);
        totalBytes += nested.totalBytes;
        fileCount += nested.fileCount;
        continue;
      }

      const stats = await fs.stat(fullPath).catch(() => null);
      if (!stats) continue;
      totalBytes += stats.size;
      fileCount += 1;
    }

    return { fileCount, totalBytes };
  }

  return walk(target);
}

export async function getSystemHealthData() {
  await ensureJobDefinitions();
  const jobs = await prisma.jobDefinition.findMany({
    orderBy: { key: "asc" }
  });
  const failedRuns = await prisma.jobRun.count({
    where: { status: "failed" }
  });
  const queueCounts = await prisma.emailQueue.groupBy({
    by: ["status"],
    _count: { _all: true }
  });
  const alerts = await prisma.systemAlert.findMany({
    where: { resolved: false },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 10
  });
  const storage = getStorageProvider() === "local"
    ? await getLocalStorageUsage()
    : { fileCount: 0, totalBytes: 0 };

  const queueStatus = {
    queued: 0,
    sent: 0,
    failed: 0
  };
  for (const row of queueCounts) {
    queueStatus[row.status] = row._count._all;
  }

  return {
    jobs,
    failedRuns,
    queueStatus,
    alerts,
    storage: {
      provider: getStorageProvider(),
      fileCount: storage.fileCount,
      totalBytes: storage.totalBytes
    }
  };
}
