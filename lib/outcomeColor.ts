/**
 * Single source of truth for the Green / Amber / Red traffic-light
 * status that's shown across the entire application surface.
 *
 *   GREEN  = passed an HR or DON gate; all good to proceed
 *   AMBER  = needs another set of eyes (HR sent to DON; or "needs second look")
 *   RED    = failed at HR or DON level; not proceeding
 *   NEUTRAL= still in motion (draft, intake, in-review, in-verification)
 */

import type { ApplicationStatus } from "@prisma/client";

export type OutcomeColor = "green" | "amber" | "red" | "neutral";

const GREEN_STATUSES: ApplicationStatus[] = [
  "approved",
  "don_approved",
  "verification_passed",
  "completed",
  "ready_for_interview",
  "final_outcome_sent"
];

const AMBER_STATUSES: ApplicationStatus[] = [
  "ready_for_don_review",
  "don_review",
  "don_review_started",
  "more_information_required"
];

const RED_STATUSES: ApplicationStatus[] = [
  "rejected",
  "don_rejected",
  "final_not_approved",
  "verification_issues_found",
  "archived"
];

export function outcomeColorFor(status: ApplicationStatus | null | undefined): OutcomeColor {
  if (!status) return "neutral";
  if (GREEN_STATUSES.includes(status)) return "green";
  if (AMBER_STATUSES.includes(status)) return "amber";
  if (RED_STATUSES.includes(status)) return "red";
  return "neutral";
}

/** Tailwind class shorthand for the four states. */
export function colorClasses(color: OutcomeColor) {
  if (color === "green")  return { bg: "bg-emerald-50",  border: "border-emerald-300", text: "text-emerald-900", dot: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-900" };
  if (color === "amber")  return { bg: "bg-amber-50",    border: "border-amber-300",   text: "text-amber-900",   dot: "bg-amber-500",   pill: "bg-amber-100 text-amber-900" };
  if (color === "red")    return { bg: "bg-red-50",      border: "border-red-300",     text: "text-red-900",     dot: "bg-red-500",     pill: "bg-red-100 text-red-900" };
  return                          { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-700",   dot: "bg-slate-400",   pill: "bg-slate-100 text-slate-700" };
}

export function colorLabel(color: OutcomeColor): string {
  if (color === "green") return "Pass";
  if (color === "amber") return "Needs Final Approval";
  if (color === "red")   return "Failed";
  return "In Progress";
}

/** Map a friendly stage label from the status (used for status pills). */
const STAGE_LABEL: Partial<Record<ApplicationStatus, string>> = {
  draft: "Drafting application",
  application_uploaded: "Documents received",
  submitted: "Submitted — awaiting HR",
  resubmitted: "Resubmitted",
  intake_review_started: "Intake review",
  applicant_correction_required: "Correction needed",
  correction_requested: "Correction requested",
  applicant_response_required: "Action needed from you",
  hr_review_pending: "Awaiting HR review",
  hr_review_started: "HR is reviewing",
  ai_analysis_in_progress: "AI analyzing",
  ai_issues_found: "AI flagged items",
  hr_resolution_required: "HR needs to resolve",
  ready_for_verification: "Ready for verification",
  under_review: "Under review",
  verification_pending: "Verification pending",
  verification_in_progress: "Verifying credentials",
  verification_issues_found: "Verification issues",
  verification_passed: "Verified",
  ready_for_don_review: "Awaiting DON",
  don_review: "DON reviewing",
  don_review_started: "DON reviewing",
  don_approved: "DON approved",
  don_rejected: "DON rejected",
  approved: "Approved for hire",
  rejected: "Not selected",
  ready_for_interview: "Ready for interview",
  more_information_required: "More info needed",
  final_outcome_sent: "Outcome sent",
  final_not_approved: "Not approved",
  completed: "Complete",
  archived: "Archived"
};

export function stageLabel(status: ApplicationStatus | null | undefined): string {
  if (!status) return "Unknown";
  return STAGE_LABEL[status] ?? status.replace(/_/g, " ");
}
