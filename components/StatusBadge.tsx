import type { ApplicationStatus } from "@prisma/client";

const labels: Record<ApplicationStatus, string> = {
  draft: "Draft",
  application_uploaded: "Application Uploaded",
  submitted: "Submitted",
  intake_review_started: "Intake Review Started",
  applicant_correction_required: "Applicant Correction Required",
  resubmitted: "Resubmitted",
  hr_review_pending: "Waiting for HR Review",
  hr_review_started: "HR Review Started",
  ai_analysis_in_progress: "Analysis In Progress",
  ai_issues_found: "Analysis Issues Found",
  applicant_response_required: "Applicant Response Required",
  hr_resolution_required: "HR Resolution Required",
  ready_for_verification: "Ready for Verification",
  under_review: "Under Review",
  correction_requested: "Correction Required",
  verification_pending: "Verification Pending",
  verification_in_progress: "Verification In Progress",
  verification_issues_found: "Verification Issues Found",
  verification_passed: "Verification Passed",
  ready_for_don_review: "Ready for DON Review",
  don_review: "DON Review",
  don_review_started: "DON Review Started",
  don_approved: "DON Approved",
  don_rejected: "DON Rejected",
  more_information_required: "More Information Required",
  final_outcome_sent: "Final Outcome Sent",
  completed: "Completed",
  ready_for_interview: "Ready for Interview",
  rejected: "Rejected",
  approved: "Approved",
  final_not_approved: "Final Not Approved",
  archived: "Archived"
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const classes: Record<ApplicationStatus, string> = {
    draft: "border-slate-200 bg-slate-50 text-slate-700",
    application_uploaded: "border-blue-200 bg-blue-50 text-blue-700",
    submitted: "border-blue-200 bg-blue-50 text-blue-700",
    intake_review_started: "border-blue-200 bg-blue-50 text-blue-700",
    applicant_correction_required: "border-orange-200 bg-orange-50 text-orange-700",
    resubmitted: "border-blue-200 bg-blue-50 text-blue-700",
    hr_review_pending: "border-blue-200 bg-blue-50 text-blue-700",
    hr_review_started: "border-purple-200 bg-purple-50 text-purple-700",
    ai_analysis_in_progress: "border-purple-200 bg-purple-50 text-purple-700",
    ai_issues_found: "border-red-200 bg-red-50 text-red-700",
    applicant_response_required: "border-orange-200 bg-orange-50 text-orange-700",
    hr_resolution_required: "border-orange-200 bg-orange-50 text-orange-700",
    ready_for_verification: "border-teal-200 bg-teal-50 text-teal-700",
    under_review: "border-purple-200 bg-purple-50 text-purple-700",
    correction_requested: "border-orange-200 bg-orange-50 text-orange-700",
    verification_pending: "border-teal-200 bg-teal-50 text-teal-700",
    verification_in_progress: "border-teal-200 bg-teal-50 text-teal-700",
    verification_issues_found: "border-red-200 bg-red-50 text-red-700",
    verification_passed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ready_for_don_review: "border-emerald-200 bg-emerald-50 text-emerald-700",
    don_review: "border-indigo-200 bg-indigo-50 text-indigo-700",
    don_review_started: "border-indigo-200 bg-indigo-50 text-indigo-700",
    don_approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    don_rejected: "border-red-200 bg-red-50 text-red-700",
    more_information_required: "border-orange-200 bg-orange-50 text-orange-700",
    final_outcome_sent: "border-blue-200 bg-blue-50 text-blue-700",
    completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ready_for_interview: "border-teal-200 bg-teal-50 text-teal-700",
    rejected: "border-red-200 bg-red-50 text-red-700",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    final_not_approved: "border-red-200 bg-red-50 text-red-700",
    archived: "border-slate-300 bg-slate-100 text-slate-700"
  };
  return (
    <span className={`qoc-badge inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes[status]}`}>
      {labels[status]}
    </span>
  );
}
