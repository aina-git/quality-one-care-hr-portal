import { prisma } from "@/lib/prisma";

export async function getPhase5HrMetrics() {
  const now = new Date();
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const draftCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const correctionCutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const reviewCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const queuedEmails = await prisma.emailQueue.count({ where: { status: "queued" } });
  const scheduledInterviews = await prisma.interviewRecord.count({ where: { status: "scheduled" } });
  const onboardingInProgress = await prisma.onboardingChecklist.count({ where: { status: "in_progress" } });
  const expiredLicenses = await prisma.license.count({ where: { applicationId: { not: null }, expiresAt: { lt: now }, application: { status: { not: "draft" } } } });
  const expiringLicenses = await prisma.license.count({ where: { applicationId: { not: null }, expiresAt: { gte: now, lte: inThirtyDays }, application: { status: { not: "draft" } } } });
  const openLicenseAlerts = await prisma.licenseAlert.count({ where: { resolved: false } });
  const overdueSubmittedReviews = await prisma.application.count({
    where: {
      status: "hr_review_pending",
      applicationSubmittedAt: { lt: reviewCutoff },
      aiReviewReports: {
        none: {
          status: "completed"
        }
      }
    }
  });
  const staleDrafts = await prisma.application.count({
    where: {
      status: "draft",
      updatedAt: { lt: draftCutoff }
    }
  });
  const staleCorrections = await prisma.application.count({
    where: {
      status: "correction_requested",
      updatedAt: { lt: correctionCutoff }
    }
  });
  const activeAlerts = await prisma.systemAlert.findMany({
    where: {
      resolved: false,
      OR: [{ targetRole: null }, { targetRole: "hr" }]
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 6
  });
  const failedJobs = await prisma.jobRun.count({ where: { status: "failed" } });
  return {
    queuedEmails,
    scheduledInterviews,
    onboardingInProgress,
    expiredLicenses,
    expiringLicenses,
    openLicenseAlerts,
    overdueSubmittedReviews,
    staleDrafts,
    staleCorrections,
    failedJobs,
    activeAlerts
  };
}
