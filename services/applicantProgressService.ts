import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ApplicantProgressStageKey =
  | "draft_started"
  | "quick_credentials_uploaded"
  | "application_submitted"
  | "hr_review_started"
  | "verification_in_progress"
  | "missing_documents_requested"
  | "ready_for_don_review"
  | "submitted_to_don"
  | "don_approved"
  | "don_rejected"
  | "onboarding_started"
  | "archived";

export type ApplicantProgressStage = {
  key: ApplicantProgressStageKey;
  label: string;
  complete: boolean;
  active: boolean;
  date: Date | null;
  tone: "gray" | "blue" | "orange" | "purple" | "teal" | "green" | "red";
};

type ProgressInput = {
  status: ApplicationStatus;
  createdAt: Date;
  submittedAt: Date | null;
  hrReviewStartedAt?: Date | null;
  updatedAt: Date;
  documents: Array<{ createdAt: Date }>;
  aiReviewReports: Array<{ createdAt: Date; status: string }>;
  finalVerificationChecklist: {
    status: string;
    updatedAt: Date;
    submittedToDonAt: Date | null;
    approvedAt: Date | null;
    rejectedAt: Date | null;
  } | null;
  applicantMessages: Array<{ createdAt: Date; subject: string; body: string }>;
  statusHistory: Array<{ toStatus: ApplicationStatus; createdAt: Date; changedBy?: { name: string | null; email: string } | null }>;
  employeeOnboarding: { createdAt: Date; status: string } | null;
};

function latestDate(values: Array<Date | null | undefined>) {
  const dates = values.filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime());
  return dates[0] ?? null;
}

export function buildApplicantProgress(application: ProgressInput) {
  const checklist = application.finalVerificationChecklist;
  const statusDate = (status: ApplicationStatus) => application.statusHistory.find((entry) => entry.toStatus === status)?.createdAt ?? null;
  const credentialsDate = latestDate(application.documents.map((document) => document.createdAt));
  const correctionDate = latestDate([
    statusDate("correction_requested"),
    ...application.applicantMessages
      .filter((message) => /missing|document|correction|clarification/i.test(`${message.subject} ${message.body}`))
      .map((message) => message.createdAt)
  ]);
  const reviewDate = latestDate([application.hrReviewStartedAt, statusDate("hr_review_started"), statusDate("under_review")]);
  const verificationDate = checklist?.updatedAt ?? null;

  const stages: ApplicantProgressStage[] = [
    {
      key: "draft_started",
      label: "Draft started",
      complete: true,
      active: application.status === "draft" && !credentialsDate,
      date: application.createdAt,
      tone: "gray"
    },
    {
      key: "quick_credentials_uploaded",
      label: "Quick credentials uploaded",
      complete: Boolean(credentialsDate),
      active: application.status === "draft" && Boolean(credentialsDate),
      date: credentialsDate,
      tone: "blue"
    },
    {
      key: "application_submitted",
      label: application.status === "hr_review_pending" ? "Waiting for HR review" : "Application submitted",
      complete: Boolean(application.submittedAt),
      active: application.status === "submitted" || application.status === "hr_review_pending",
      date: application.submittedAt,
      tone: "blue"
    },
    {
      key: "hr_review_started",
      label: "HR review started",
      complete: Boolean(reviewDate) || ["hr_review_started", "under_review", "verification_pending", "verification_in_progress", "ready_for_don_review", "don_review", "ready_for_interview", "approved", "rejected", "final_not_approved", "archived"].includes(application.status),
      active: application.status === "hr_review_started" || application.status === "under_review",
      date: reviewDate,
      tone: "purple"
    },
    {
      key: "verification_in_progress",
      label: "Verification in progress",
      complete: Boolean(checklist),
      active: application.status === "verification_in_progress" || checklist?.status === "in_progress",
      date: verificationDate,
      tone: "teal"
    },
    {
      key: "missing_documents_requested",
      label: "Missing documents requested",
      complete: Boolean(correctionDate),
      active: application.status === "correction_requested" || checklist?.status === "returned_for_correction",
      date: correctionDate,
      tone: "orange"
    },
    {
      key: "ready_for_don_review",
      label: "Ready for DON review",
      complete: checklist?.status === "ready_for_don_review" || checklist?.status === "approved_by_don" || checklist?.status === "rejected_by_don",
      active: application.status === "ready_for_don_review" || checklist?.status === "ready_for_don_review",
      date: checklist?.submittedToDonAt ?? null,
      tone: "green"
    },
    {
      key: "submitted_to_don",
      label: "Submitted to DON",
      complete: Boolean(checklist?.submittedToDonAt),
      active: application.status === "don_review" || checklist?.status === "ready_for_don_review",
      date: checklist?.submittedToDonAt ?? null,
      tone: "green"
    },
    {
      key: "don_approved",
      label: "DON approved",
      complete: checklist?.status === "approved_by_don",
      active: checklist?.status === "approved_by_don",
      date: checklist?.approvedAt ?? null,
      tone: "green"
    },
    {
      key: "don_rejected",
      label: "DON rejected",
      complete: checklist?.status === "rejected_by_don" || application.status === "final_not_approved",
      active: checklist?.status === "rejected_by_don" || application.status === "final_not_approved",
      date: checklist?.rejectedAt ?? statusDate("final_not_approved"),
      tone: "red"
    },
    {
      key: "onboarding_started",
      label: "Onboarding started",
      complete: Boolean(application.employeeOnboarding),
      active: application.employeeOnboarding?.status === "in_progress",
      date: application.employeeOnboarding?.createdAt ?? null,
      tone: "teal"
    },
    {
      key: "archived",
      label: "Archived",
      complete: application.status === "archived",
      active: application.status === "archived",
      date: statusDate("archived"),
      tone: "gray"
    }
  ];

  const activeStage = [...stages].reverse().find((stage) => stage.active) ?? [...stages].reverse().find((stage) => stage.complete) ?? stages[0];
  const responsibleStaff = application.statusHistory.find((entry) => entry.changedBy)?.changedBy;
  const lastUpdated = latestDate([
    application.updatedAt,
    application.submittedAt,
    credentialsDate,
    reviewDate,
    verificationDate,
    checklist?.submittedToDonAt,
    checklist?.approvedAt,
    checklist?.rejectedAt,
    application.employeeOnboarding?.createdAt
  ]) ?? application.updatedAt;
  const nextActionRequired = application.status === "draft"
    ? "Applicant should review extracted information and complete the remaining application."
    : application.status === "hr_review_pending"
      ? "Your application is waiting for HR review."
      : application.status === "hr_review_started"
        ? "HR has started reviewing your application."
    : application.status === "correction_requested"
      ? "Applicant should resolve requested corrections and resubmit."
      : checklist?.status === "in_progress"
        ? "HR should complete verification checklist items."
        : checklist?.status === "ready_for_don_review"
          ? "Authorized DON reviewer should complete final approval."
          : checklist?.status === "returned_for_correction"
            ? "HR should correct checklist blockers returned by DON."
            : application.employeeOnboarding
              ? "Onboarding tasks are in progress."
              : "Monitor application for the next workflow action.";

  return {
    stages,
    activeStage,
    lastUpdated,
    responsibleStaff: responsibleStaff ? responsibleStaff.name ?? responsibleStaff.email : "Unassigned",
    nextActionRequired
  };
}

export async function getApplicationProgress(applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      documents: { select: { createdAt: true } },
      aiReviewReports: { select: { createdAt: true, status: true }, orderBy: { createdAt: "desc" } },
      finalVerificationChecklist: {
        select: {
          status: true,
          updatedAt: true,
          submittedToDonAt: true,
          approvedAt: true,
          rejectedAt: true
        }
      },
      applicantMessages: { select: { createdAt: true, subject: true, body: true }, orderBy: { createdAt: "desc" } },
      statusHistory: {
        select: {
          toStatus: true,
          createdAt: true,
          changedBy: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: "desc" }
      },
      employeeOnboarding: { select: { createdAt: true, status: true } }
    }
  });
  if (!application) return null;
  return buildApplicantProgress(application);
}
