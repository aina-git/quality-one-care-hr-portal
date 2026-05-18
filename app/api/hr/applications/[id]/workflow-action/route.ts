import type { ApplicationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security";
import { sendCommunication } from "@/services/communications/communicationService";
import { ensureFinalVerificationChecklist, refreshChecklistStatus, summarizeChecklist, getVerificationChecklist } from "@/services/verification/verificationService";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";
import { startHrReviewWorkflow } from "@/services/workflow/hrReviewQueueService";
import { withApi } from "@/services/monitoring/errorService";

const actions = [
  "start_hr_review",
  "request_missing_document",
  "mark_verification_in_progress",
  "mark_ready_for_don_review",
  "submit_to_don",
  "return_to_applicant",
  "put_on_hold",
  "reject_hr_screening",
  "archive_application"
] as const;

type WorkflowAction = (typeof actions)[number];

function statusFor(action: WorkflowAction): ApplicationStatus | null {
  if (action === "start_hr_review") return "hr_review_started";
  if (action === "mark_verification_in_progress") return "verification_in_progress";
  if (action === "put_on_hold") return "under_review";
  if (action === "request_missing_document") return "applicant_response_required";
  if (action === "return_to_applicant") return "applicant_correction_required";
  if (action === "reject_hr_screening") return "rejected";
  if (action === "archive_application") return "archived";
  return null;
}

export const POST = withApi({ scope: "hr.workflow_action", entityType: "application", fallbackMessage: "Could not perform workflow action." }, async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(["hr", "super_admin_hr"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const actionValue = sanitizeText(body.action, 80);
  if (!actions.includes(actionValue as WorkflowAction)) {
    return NextResponse.json({ error: "Choose a valid workflow action." }, { status: 400 });
  }
  const action = actionValue as WorkflowAction;
  const note = sanitizeText(body.note, 4000);
  if (!note) return NextResponse.json({ error: "A reason or comment is required." }, { status: 400 });

  const application = await prisma.application.findUnique({
    where: { id },
    include: { applicantProfile: { include: { user: true } }, finalVerificationChecklist: true }
  });
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (application.status === "draft" && action !== "archive_application") {
    return NextResponse.json({ error: "Draft applications cannot be advanced by HR workflow actions." }, { status: 400 });
  }

  if (action === "mark_ready_for_don_review" || action === "submit_to_don") {
    const checklist = await getVerificationChecklist(id);
    if (!checklist) return NextResponse.json({ error: "Create and complete the final verification checklist first." }, { status: 400 });
    const summary = summarizeChecklist(checklist);
    if (!summary.readyForDon) {
      return NextResponse.json({ error: `Resolve ${summary.criticalBlockers.length} critical blocker(s) and ${summary.missingItems.length} missing item(s) before DON submission.` }, { status: 400 });
    }
    const updated = await refreshChecklistStatus(checklist.id, user.id);
    await updateApplicationLifecycle({
      applicationId: id,
      userId: user.id,
      action: action === "submit_to_don" ? "submitted_to_don" : "workflow_ready_for_don",
      patch: { submittedToDonAt: new Date(), status: action === "submit_to_don" ? "don_review_started" : "ready_for_don_review" },
      details: { note, checklistId: updated.id }
    });
    await logAction(user.id, action === "submit_to_don" ? "submitted_to_don" : "workflow_ready_for_don", "application", id, { note, checklistId: updated.id });
    return NextResponse.json({ message: "Checklist is ready for DON review.", checklist: updated });
  }

  if (action === "mark_verification_in_progress") {
    await ensureFinalVerificationChecklist(id, user.id);
  }

  if (action === "start_hr_review" && application.status === "hr_review_pending") {
    const updated = await startHrReviewWorkflow(id, user.id);
    return NextResponse.json({ message: "HR review started.", application: updated });
  }

  const nextStatus = statusFor(action);
  const lifecyclePatch = nextStatus === "hr_review_started" && action === "start_hr_review"
    ? { status: nextStatus, hrReviewStartedAt: new Date() }
    : nextStatus === "rejected"
      ? { status: nextStatus, rejectedAt: new Date() }
      : nextStatus === "verification_in_progress"
        ? { status: nextStatus, verificationStartedAt: new Date() }
      : nextStatus
        ? { status: nextStatus }
        : {};
  const updated = nextStatus
    ? await updateApplicationLifecycle({
        applicationId: id,
        userId: user.id,
        action: `workflow_${action}`,
        patch: lifecyclePatch,
        details: { note }
      })
    : application;

  if (action === "request_missing_document" || action === "return_to_applicant") {
    await sendCommunication({
      applicationId: id,
      senderId: user.id,
      senderRole: user.role,
      channel: "in_app",
      subject: "Action needed on your Quality One Care application",
      body: note,
      visibleToApplicant: true
    });
  }

  await logAction(user.id, `workflow_${action}`, "application", id, {
    fromStatus: application.status,
    toStatus: nextStatus,
    note
  });
  return NextResponse.json({ message: "Workflow updated.", application: updated });
});
