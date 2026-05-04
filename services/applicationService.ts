import { ApplicationStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export const applicationSections = [
  "Personal Info",
  "Employment History",
  "Pediatric Experience",
  "Licenses",
  "Certifications",
  "References",
  "Documents"
];

export const applicationPageSections = [...applicationSections, "Review"];

export function statusLabel(status: ApplicationStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function getOrCreateApplicantApplication(userId: string) {
  const profile =
    (await prisma.applicantProfile.findUnique({
      where: { userId },
      include: { applications: { orderBy: { updatedAt: "desc" }, take: 1 } }
    })) ??
    (await prisma.applicantProfile.create({
      data: { userId },
      include: { applications: { orderBy: { updatedAt: "desc" }, take: 1 } }
    }));

  if (profile.applications[0]) return { profile, application: profile.applications[0], created: false };

  const application = await prisma.application.create({
    data: {
      applicantProfileId: profile.id,
      status: "draft",
      currentStatus: "draft",
      desiredRole: "Home Health Care",
      intakeMode: "digital",
      intakeType: "digital",
      createdById: userId,
      lastActionById: userId,
      lastActionAt: new Date()
    }
  });

  await logAction(userId, "application_created", "application", application.id, {
    intakeType: "digital",
    applicationCreatedAt: application.applicationCreatedAt
  });

  return { profile, application, created: true };
}

export async function getLatestApplicantApplication(userId: string) {
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId },
    include: { applications: { orderBy: { updatedAt: "desc" }, take: 1 } }
  });
  return { profile, application: profile?.applications[0] ?? null };
}

export async function getApplicationMetrics() {
  const total = await prisma.application.count({ where: { status: { not: "draft" } } });
  const submitted = await prisma.application.count({ where: { status: { in: ["submitted", "hr_review_pending"] } } });
  const pendingHrReview = await prisma.application.count({ where: { status: "hr_review_pending" } });
  const hrReviewStarted = await prisma.application.count({ where: { status: "hr_review_started" } });
  const underReview = await prisma.application.count({ where: { status: { in: ["under_review", "hr_review_started"] } } });
  const verificationPending = await prisma.application.count({ where: { status: "verification_pending" } });
  const verificationInProgress = await prisma.application.count({ where: { status: "verification_in_progress" } });
  const readyForDonReview = await prisma.application.count({ where: { status: "ready_for_don_review" } });
  const ready = await prisma.application.count({ where: { status: "ready_for_interview" } });
  const correction = await prisma.application.count({ where: { status: "correction_requested" } });
  return { total, submitted, pendingHrReview, hrReviewStarted, underReview, verificationPending, verificationInProgress, readyForDonReview, ready, correction };
}

export async function getAdminMetrics() {
  const totalUsers = await prisma.user.count();
  const applicants = await prisma.user.count({ where: { role: "applicant" } });
  const hrUsers = await prisma.user.count({ where: { role: "hr" } });
  const applications = await prisma.application.count();
  return { totalUsers, applicants, hrUsers, applications };
}

export async function getUsersByRole(role?: Role) {
  return prisma.user.findMany({
    where: role ? { role } : undefined,
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true }
  });
}
