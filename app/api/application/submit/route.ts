import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";
import { ensureHrReviewQueueForApplication } from "@/services/workflow/hrReviewQueueService";
import { transitionApplication } from "@/services/workflow/controlledWorkflowService";
import { withApi } from "@/services/monitoring/errorService";

export const POST = withApi({ scope: "application.submit", entityType: "application", fallbackMessage: "Could not submit application." }, async () => {
  const user = await requireRole(["applicant"]);
  const { application } = await getOrCreateApplicantApplication(user.id);
  await transitionApplication({
    applicationId: application.id,
    userId: user.id,
    status: "intake_review_started",
    action: "intake_review_started",
    note: "Applicant submitted application for intake review.",
    notifyStaff: false,
    createTask: false
  });
  const validation = await validateApplication(application.id, user.id);

  const correctionStatuses = ["correction_requested", "applicant_correction_required", "applicant_response_required", "more_information_required"];
  if (!["draft", "application_uploaded", "intake_review_started", ...correctionStatuses].includes(application.status)) {
    return NextResponse.json({ error: "This application has already been submitted." }, { status: 400 });
  }

  if (!validation.canSubmit) {
    await transitionApplication({
      applicationId: application.id,
      userId: user.id,
      status: "applicant_correction_required",
      action: "intake_issues_found",
      note: `Your application has ${validation.blockingIssues.length} required item(s) that must be corrected before HR review.`,
      notifyApplicant: true,
      taskTitle: "Applicant correction required",
      taskDescription: "Applicant must correct missing, unclear, conflicting, unreadable, unsigned, or expired items before HR review.",
      taskPriority: "high"
    });
    return NextResponse.json({ error: "Your application is not ready to submit.", validation }, { status: 400 });
  }

  if (correctionStatuses.includes(application.status)) {
    await transitionApplication({
      applicationId: application.id,
      userId: user.id,
      status: "resubmitted",
      action: "application_resubmitted",
      note: "Applicant corrected and resubmitted the application.",
      createTask: false
    });
  }

  const updated = await updateApplicationLifecycle({
    applicationId: application.id,
    userId: user.id,
    action: "application_submitted",
    patch: {
      status: "hr_review_pending",
      applicationSubmittedAt: new Date()
    },
    details: { operationalStatus: "hr_review_pending" }
  });
  await ensureHrReviewQueueForApplication({ applicationId: application.id, userId: user.id, source: "applicant_submission" });
  await logAction(user.id, "application_submitted", "application", application.id);

  return NextResponse.json({ application: updated });
});
