/**
 * Auto-reminder service for scheduled interviews.
 *
 * Runs hourly. Finds scheduled interviews where:
 *   - 24h reminder window: scheduledAt is 23–25 hours from now AND no `reminder_24h_sent` flag
 *   - 2h reminder window: scheduledAt is 1.5–2.5 hours from now AND no `reminder_2h_sent` flag
 *
 * Creates an applicant in-app message + queues email. Records the reminder marker
 * by appending a structured token to interview.notes (no schema migration needed).
 */

import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { createApplicantMessageWithEmail } from "@/services/notifications/emailService";
import { renderMessageTemplate } from "@/services/notifications/messageTemplateService";

const HOUR_MS = 60 * 60 * 1000;

const REMINDER_24H_MARKER = "[REMINDER_24H_SENT]";
const REMINDER_2H_MARKER = "[REMINDER_2H_SENT]";

function hasMarker(notes: string | null, marker: string) {
  return Boolean(notes && notes.includes(marker));
}

function formatWhen(date: Date) {
  return date.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
}

export async function runInterviewReminderScan(): Promise<{
  remindersSent24h: number;
  remindersSent2h: number;
}> {
  const now = Date.now();

  // 24-hour window: 23 to 25 hours out
  const min24 = new Date(now + 23 * HOUR_MS);
  const max24 = new Date(now + 25 * HOUR_MS);
  const interviews24 = await prisma.interviewRecord.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: min24, lte: max24 }
    },
    include: { application: { include: { applicantProfile: { include: { user: true } } } } }
  });

  let sent24 = 0;
  for (const iv of interviews24) {
    if (hasMarker(iv.notes, REMINDER_24H_MARKER)) continue;
    if (!iv.scheduledAt) continue;
    const when = iv.scheduledAt;
    const template = await renderMessageTemplate("interview_reminder_24h", {
      scheduledAt: formatWhen(when),
      location: iv.location ?? "to be confirmed"
    }).catch(() => ({
      templateKey: "interview_reminder_24h",
      subject: "Reminder: Your Quality One Care interview is tomorrow",
      body: `This is a reminder that your interview is scheduled for ${formatWhen(when)}.${iv.location ? ` Location: ${iv.location}.` : ""} Please reply if you need to reschedule.`
    }));
    await createApplicantMessageWithEmail({
      applicationId: iv.applicationId,
      senderId: iv.createdById,
      senderRole: "system",
      templateKey: template.templateKey,
      subject: template.subject,
      body: template.body,
      userIdForAudit: null
    });
    await prisma.interviewRecord.update({
      where: { id: iv.id },
      data: { notes: `${iv.notes ? iv.notes + "\n" : ""}${REMINDER_24H_MARKER} sent ${new Date().toISOString()}` }
    });
    await logAction(null, "interview_reminder_24h_sent", "interview", iv.id, { applicationId: iv.applicationId });
    sent24++;
  }

  // 2-hour window: 1.5 to 2.5 hours out
  const min2 = new Date(now + 1.5 * HOUR_MS);
  const max2 = new Date(now + 2.5 * HOUR_MS);
  const interviews2 = await prisma.interviewRecord.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: min2, lte: max2 }
    },
    include: { application: { include: { applicantProfile: { include: { user: true } } } } }
  });

  let sent2 = 0;
  for (const iv of interviews2) {
    if (hasMarker(iv.notes, REMINDER_2H_MARKER)) continue;
    if (!iv.scheduledAt) continue;
    const when = iv.scheduledAt;
    const template = await renderMessageTemplate("interview_reminder_2h", {
      scheduledAt: formatWhen(when),
      location: iv.location ?? "to be confirmed"
    }).catch(() => ({
      templateKey: "interview_reminder_2h",
      subject: "Reminder: Your Quality One Care interview is in 2 hours",
      body: `Your interview is at ${formatWhen(when)} (about 2 hours from now).${iv.location ? ` Location: ${iv.location}.` : ""}`
    }));
    await createApplicantMessageWithEmail({
      applicationId: iv.applicationId,
      senderId: iv.createdById,
      senderRole: "system",
      templateKey: template.templateKey,
      subject: template.subject,
      body: template.body,
      userIdForAudit: null
    });
    await prisma.interviewRecord.update({
      where: { id: iv.id },
      data: { notes: `${iv.notes ? iv.notes + "\n" : ""}${REMINDER_2H_MARKER} sent ${new Date().toISOString()}` }
    });
    await logAction(null, "interview_reminder_2h_sent", "interview", iv.id, { applicationId: iv.applicationId });
    sent2++;
  }

  return { remindersSent24h: sent24, remindersSent2h: sent2 };
}
