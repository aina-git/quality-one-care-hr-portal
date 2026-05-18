import type { ApplicationStatus, HRDecisionAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { createApplicantMessageWithEmail } from "@/services/notifications/emailService";
import { renderMessageTemplate } from "@/services/notifications/messageTemplateService";
import { ensureOnboardingChecklist } from "@/services/onboarding/onboardingService";
import { ensureFinalVerificationChecklist } from "@/services/verification/verificationService";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";

export const decisionStatusMap: Record<HRDecisionAction, ApplicationStatus> = {
  proceed_to_interview: "ready_for_interview",
  request_clarification: "correction_requested",
  place_on_hold: "under_review",
  mark_not_selected: "rejected",
  approve_for_onboarding: "approved",
  // HR / admin pushes the application to the Verification stage even when
  // open issues remain. DON / HR verify the flagged items manually from
  // the Verification screen — open issues here aren't a hard block.
  send_to_verification: "ready_for_verification"
};

export function decisionLabel(action: HRDecisionAction) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function createHRDecision({
  applicationId,
  action,
  note,
  userId,
  userRole
}: {
  applicationId: string;
  action: HRDecisionAction;
  note: string;
  userId: string;
  userRole: "hr" | "super_admin_hr";
}) {
  const cleanNote = note.trim();
  if (!cleanNote) throw new Error("Decision note is required.");

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicantProfile: { include: { user: true } } }
  });
  if (!application) throw new Error("Application not found.");
  if (application.status === "draft") throw new Error("Draft application decision is blocked.");

  const toStatus = decisionStatusMap[action];
  const fromStatus = application.status;

  const decision = await prisma.$transaction(async (tx) => {
    const decision = await tx.hRDecision.create({
      data: {
        applicationId,
        action,
        fromStatus,
        toStatus,
        note: cleanNote,
        createdById: userId
      }
    });

    if (action === "proceed_to_interview") {
      const existingInterview = await tx.interviewRecord.findFirst({ where: { applicationId } });
      if (!existingInterview) {
        await tx.interviewRecord.create({
          data: {
            applicationId,
            status: "pending",
            notes: cleanNote,
            createdById: userId
          }
        });
      }
    }

    return decision;
  });

  await updateApplicationLifecycle({
    applicationId,
    userId,
    action: `hr_decision_${action}`,
    patch: {
      status: toStatus,
      hrReviewStartedAt: action === "place_on_hold" ? new Date() : undefined,
      rejectedAt: action === "mark_not_selected" ? new Date() : undefined
    },
    details: { note: cleanNote }
  });

  await logAction(userId, "hr_decision_created", "application", applicationId, {
    action,
    fromStatus,
    toStatus
  });
  if (action === "request_clarification") {
    const template = await renderMessageTemplate("clarification_requested", { note: cleanNote });
    await createApplicantMessageWithEmail({
      applicationId,
      senderId: userId,
      senderRole: userRole,
      templateKey: template.templateKey,
      subject: template.subject,
      body: template.body,
      userIdForAudit: userId
    });
    await logAction(userId, "applicant_clarification_requested", "application", applicationId);
  }
  if (action === "proceed_to_interview") {
    await logAction(userId, "interview_record_created", "application", applicationId);
  }
  if (action === "approve_for_onboarding") {
    await ensureOnboardingChecklist(applicationId, userId);
    await ensureFinalVerificationChecklist(applicationId, userId);
    await logAction(userId, "application_approved_for_onboarding", "application", applicationId);
  }
  if (action === "send_to_verification") {
    await ensureFinalVerificationChecklist(applicationId, userId);
    await logAction(userId, "application_sent_to_verification", "application", applicationId);
  }

  return decision;
}

export async function createHRNote(applicationId: string, note: string, userId: string) {
  const cleanNote = note.trim();
  if (!cleanNote) throw new Error("Note is required.");
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error("Application not found.");
  if (application.status === "draft") throw new Error("Draft application notes are blocked.");

  const created = await prisma.hRNote.create({
    data: { applicationId, note: cleanNote, createdById: userId }
  });
  await logAction(userId, "hr_note_created", "application", applicationId);
  return created;
}
