import type { MessageChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { createApplicantMessageWithEmail, queueOrSendEmail } from "@/services/notifications/emailService";
import { queueSms, queueWhatsApp } from "@/services/notifications/channelProviders";
import { createNotification } from "@/services/operations/notificationService";

function senderRoleFor(role: string): "applicant" | "hr" | "admin" | "system" {
  if (role === "applicant") return "applicant";
  if (role === "admin" || role === "super_admin_hr") return "admin";
  if (role === "system") return "system";
  return "hr";
}

export async function sendCommunication({
  applicationId,
  senderId,
  senderRole,
  channel,
  subject,
  body,
  visibleToApplicant = true
}: {
  applicationId: string;
  senderId: string;
  senderRole: string;
  channel: MessageChannel;
  subject: string;
  body: string;
  visibleToApplicant?: boolean;
}) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicantProfile: { include: { user: true } } }
  });
  if (!application) throw new Error("Application not found.");
  const cleanSubject = sanitizeText(subject, 200) || "Message from Quality One Care";
  const cleanBody = sanitizeText(body, 5000);
  if (!cleanBody) throw new Error("Message body is required.");

  let status: "queued" | "sent" | "failed" = "queued";
  let providerResponse: unknown = null;

  if (channel === "in_app") {
    const { message } = await createApplicantMessageWithEmail({
      applicationId,
      senderId,
      senderRole: senderRoleFor(senderRole),
      subject: cleanSubject,
      body: cleanBody,
      visibleToApplicant,
      userIdForAudit: senderId
    });
    providerResponse = { applicantMessageId: message.id };
    status = "sent";
  } else if (channel === "email") {
    const email = await queueOrSendEmail({
      toEmail: application.applicantProfile.user.email,
      subject: cleanSubject,
      body: cleanBody,
      applicationId,
      userId: senderId
    });
    providerResponse = { emailQueueId: email.id, status: email.status };
    status = email.status;
  } else if (channel === "sms") {
    const phone = application.applicantProfile.phone ?? "";
    if (!phone) throw new Error("Applicant phone number is missing.");
    const sms = await queueSms({ applicationId, toPhone: phone, body: cleanBody, userId: senderId });
    providerResponse = { smsQueueId: sms.id };
  } else if (channel === "whatsapp") {
    const phone = application.applicantProfile.phone ?? "";
    if (!phone) throw new Error("Applicant phone number is missing.");
    const whatsapp = await queueWhatsApp({ applicationId, toPhone: phone, body: cleanBody, userId: senderId });
    providerResponse = { whatsAppQueueId: whatsapp.id };
  }

  const log = await prisma.communicationLog.create({
    data: {
      applicationId,
      senderId,
      recipientUserId: application.applicantProfile.userId,
      recipientEmail: application.applicantProfile.user.email,
      channel,
      subject: cleanSubject,
      body: cleanBody,
      status,
      provider: channel === "email" ? process.env.EMAIL_PROVIDER || null : channel === "sms" ? process.env.SMS_PROVIDER || null : channel === "whatsapp" ? process.env.WHATSAPP_PROVIDER || null : "in_app",
      providerResponse: providerResponse as object
    }
  });

  await createNotification({
    userId: application.applicantProfile.userId,
    applicationId,
    notificationType: "message",
    priority: channel === "sms" || channel === "whatsapp" ? "high" : "normal",
    title: cleanSubject,
    body: cleanBody,
    route: "/applicant/messages"
  });
  await logAction(senderId, status === "sent" ? "message_sent" : "message_queued", "communication", log.id, {
    applicationId,
    channel,
    status
  });
  return log;
}
