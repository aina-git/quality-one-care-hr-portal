import type { InterviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { createApplicantMessageWithEmail } from "@/services/notifications/emailService";
import { renderMessageTemplate } from "@/services/notifications/messageTemplateService";

function formatDate(value: Date | null | undefined) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "to be confirmed";
}

export async function scheduleOrUpdateInterview({
  applicationId,
  interviewId,
  scheduledAt,
  location,
  notes,
  userId,
  userRole
}: {
  applicationId: string;
  interviewId?: string;
  scheduledAt: Date;
  location?: string;
  notes?: string;
  userId: string;
  userRole: "hr" | "super_admin_hr";
}) {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error("Application not found.");
  if (application.status === "draft") throw new Error("Draft applications cannot have interviews scheduled.");

  const existing = interviewId
    ? await prisma.interviewRecord.findUnique({ where: { id: interviewId } })
    : await prisma.interviewRecord.findFirst({ where: { applicationId, status: { not: "cancelled" } }, orderBy: { createdAt: "desc" } });
  if (existing && existing.applicationId !== applicationId) throw new Error("Interview not found.");

  const interview = existing
    ? await prisma.interviewRecord.update({
        where: { id: existing.id },
        data: { status: "scheduled", scheduledAt, location: location?.trim() || null, notes: notes?.trim() || null }
      })
    : await prisma.interviewRecord.create({
        data: {
          applicationId,
          status: "scheduled",
          scheduledAt,
          location: location?.trim() || null,
          notes: notes?.trim() || null,
          createdById: userId
        }
      });

  const template = await renderMessageTemplate(existing ? "interview_updated" : "interview_scheduled", {
    scheduledAt: formatDate(scheduledAt),
    location: location || "to be confirmed",
    notes: notes || ""
  });
  await createApplicantMessageWithEmail({
    applicationId,
    senderId: userId,
    senderRole: userRole,
    templateKey: template.templateKey,
    subject: template.subject,
    body: template.body,
    userIdForAudit: userId
  });
  await logAction(userId, existing ? "interview_updated" : "interview_scheduled", "interview", interview.id, {
    applicationId,
    scheduledAt: scheduledAt.toISOString()
  });

  return interview;
}

export async function updateInterviewStatus({
  applicationId,
  interviewId,
  status,
  notes,
  userId,
  userRole
}: {
  applicationId: string;
  interviewId: string;
  status: InterviewStatus;
  notes?: string;
  userId: string;
  userRole: "hr" | "super_admin_hr";
}) {
  const interview = await prisma.interviewRecord.findUnique({ where: { id: interviewId } });
  if (!interview || interview.applicationId !== applicationId) throw new Error("Interview not found.");
  if (status === "cancelled") {
    const updated = await prisma.interviewRecord.update({
      where: { id: interviewId },
      data: { status, notes: notes?.trim() || interview.notes }
    });
    const template = await renderMessageTemplate("interview_cancelled", { notes: notes || "" });
    await createApplicantMessageWithEmail({
      applicationId,
      senderId: userId,
      senderRole: userRole,
      templateKey: template.templateKey,
      subject: template.subject,
      body: template.body,
      userIdForAudit: userId
    });
    await logAction(userId, "interview_cancelled", "interview", interviewId, { applicationId });
    return updated;
  }

  const updated = await prisma.interviewRecord.update({
    where: { id: interviewId },
    data: { status, notes: notes?.trim() || interview.notes }
  });
  await logAction(userId, "interview_status_updated", "interview", interviewId, { applicationId, status });
  return updated;
}
