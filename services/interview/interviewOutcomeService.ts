/**
 * Post-interview outcome capture.
 *
 * After HR conducts an interview, they record an outcome (passed / failed / no_show / rescheduled)
 * with notes. The system:
 *   - Sets InterviewRecord.status = "completed" (or "scheduled" for reschedule/no_show)
 *   - Appends a structured outcome marker to notes
 *   - Sends an applicant message appropriate to the outcome
 *   - Creates an HR follow-up task to advance the application
 *
 * Outcome → HR decision suggestion (the actual decision is still HR's to make):
 *   - passed   → suggest "approve_for_onboarding"
 *   - failed   → suggest "mark_not_selected"
 *   - no_show  → suggest follow-up message + reschedule
 */

import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { createApplicantMessageWithEmail } from "@/services/notifications/emailService";

export type InterviewOutcome = "passed" | "failed" | "no_show" | "rescheduled";

const OUTCOME_MARKER_PREFIX = "[OUTCOME:";

function buildOutcomeMarker(outcome: InterviewOutcome) {
  return `${OUTCOME_MARKER_PREFIX}${outcome}] recorded ${new Date().toISOString()}`;
}

export async function recordInterviewOutcome({
  applicationId,
  interviewId,
  outcome,
  hrNote,
  userId,
  userRole
}: {
  applicationId: string;
  interviewId: string;
  outcome: InterviewOutcome;
  hrNote: string;
  userId: string;
  userRole: "hr" | "super_admin_hr" | "super_admin_hr";
}) {
  if (!hrNote.trim()) {
    throw new Error("Interview outcome note is required.");
  }
  const interview = await prisma.interviewRecord.findUnique({ where: { id: interviewId } });
  if (!interview || interview.applicationId !== applicationId) throw new Error("Interview not found.");

  const newStatus =
    outcome === "passed" || outcome === "failed" ? "completed" :
    outcome === "no_show" ? "completed" :
    "scheduled"; // rescheduled keeps it open; HR will then update scheduledAt

  const newNotes = [
    interview.notes,
    buildOutcomeMarker(outcome),
    `HR note: ${hrNote.trim()}`
  ].filter(Boolean).join("\n");

  const updated = await prisma.interviewRecord.update({
    where: { id: interview.id },
    data: { status: newStatus, notes: newNotes }
  });

  // Applicant message
  const messageBody =
    outcome === "passed"
      ? `Thank you for interviewing with Quality One Care. We will follow up with next steps shortly.`
      : outcome === "failed"
        ? `Thank you for taking the time to interview with Quality One Care. We will be in touch with our decision.`
        : outcome === "no_show"
          ? `We missed you at your scheduled interview. Please contact HR to reschedule at your earliest convenience.`
          : `Your interview is being rescheduled. We'll send you the new time shortly.`;
  const messageSubject =
    outcome === "no_show"
      ? "Missed interview — please reschedule"
      : outcome === "rescheduled"
        ? "Interview rescheduled"
        : "Thank you for your interview";

  await createApplicantMessageWithEmail({
    applicationId,
    senderId: userId,
    senderRole: userRole === "super_admin_hr" ? "super_admin_hr" : userRole,
    templateKey: `interview_outcome_${outcome}`,
    subject: messageSubject,
    body: messageBody,
    userIdForAudit: userId
  });

  // HR follow-up task
  const taskTitleByOutcome: Record<InterviewOutcome, string> = {
    passed: "Decide on hire after interview pass",
    failed: "Send rejection or move to hold after interview fail",
    no_show: "Reschedule or close out after applicant no-show",
    rescheduled: "Confirm new interview time with applicant"
  };
  await prisma.task.create({
    data: {
      relatedApplicationId: applicationId,
      title: taskTitleByOutcome[outcome],
      description: `Interview ${outcome.replace(/_/g, " ")}. HR note: ${hrNote.trim()}`,
      priority: outcome === "passed" || outcome === "failed" ? "high" : "normal",
      status: "open",
      category: "interview",
      assignedToUserId: userId,
      createdByUserId: userId,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    }
  });

  await logAction(userId, "interview_outcome_recorded", "interview", interview.id, {
    applicationId,
    outcome,
    hrNote: hrNote.trim().slice(0, 200)
  });

  return updated;
}

export function parseOutcomeFromNotes(notes: string | null): InterviewOutcome | null {
  if (!notes) return null;
  const match = notes.match(/\[OUTCOME:(passed|failed|no_show|rescheduled)\]/);
  return match ? (match[1] as InterviewOutcome) : null;
}
