import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getEmailProvider } from "@/lib/env";
import { captureFailureLog } from "@/services/monitoring/errorService";

type EmailInput = {
  toEmail: string;
  subject: string;
  body: string;
  applicationId?: string;
  applicantMessageId?: string;
  userId?: string | null;
};

export function isEmailProviderConfigured() {
  return Boolean(getEmailProvider() && process.env.EMAIL_API_KEY);
}

async function sendWithProvider(input: EmailInput) {
  const provider = getEmailProvider();
  if (provider === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "noreply@qualityonecare.local",
        to: input.toEmail,
        subject: input.subject,
        text: input.body
      })
    });
    if (!response.ok) {
      throw new Error(`Resend email failed with status ${response.status}`);
    }
    const payload = (await response.json()) as { id?: string };
    return { provider, providerMessageId: payload.id ?? null };
  }

  if (provider === "sendgrid") {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.toEmail }] }],
        from: { email: process.env.EMAIL_FROM ?? "noreply@qualityonecare.local" },
        subject: input.subject,
        content: [{ type: "text/plain", value: input.body }]
      })
    });
    if (!response.ok) {
      throw new Error(`SendGrid email failed with status ${response.status}`);
    }
    return { provider, providerMessageId: null };
  }

  throw new Error("Unsupported email provider.");
}

async function syncMessageAttempt(messageId: string | null | undefined, updates: { retryCount?: number; lastAttemptAt?: Date | null }) {
  if (!messageId) return;
  await prisma.applicantMessage.update({
    where: { id: messageId },
    data: {
      retryCount: updates.retryCount,
      lastAttemptAt: updates.lastAttemptAt ?? undefined
    }
  }).catch(() => null);
}

export async function sendEmailQueueEntry(emailQueueId: string, userId?: string | null) {
  const queueEntry = await prisma.emailQueue.findUnique({ where: { id: emailQueueId } });
  if (!queueEntry) {
    throw new Error("Email queue item not found.");
  }

  if (!isEmailProviderConfigured()) {
    await syncMessageAttempt(queueEntry.applicantMessageId, { lastAttemptAt: new Date() });
    return {
      queueEntry,
      status: "queued" as const,
      skipped: true
    };
  }

  const nextAttempt = queueEntry.attempts + 1;
  const attemptedAt = new Date();
  await syncMessageAttempt(queueEntry.applicantMessageId, {
    retryCount: nextAttempt,
    lastAttemptAt: attemptedAt
  });

  try {
    const sent = await sendWithProvider({
      toEmail: queueEntry.toEmail,
      subject: queueEntry.subject,
      body: queueEntry.body,
      applicationId: queueEntry.applicationId ?? undefined,
      applicantMessageId: queueEntry.applicantMessageId ?? undefined,
      userId: userId ?? null
    });
    const updated = await prisma.emailQueue.update({
      where: { id: queueEntry.id },
      data: {
        provider: sent.provider,
        providerMessageId: sent.providerMessageId,
        status: "sent",
        attempts: nextAttempt,
        sentAt: attemptedAt,
        errorMessage: null
      }
    });
    await logAction(userId ?? null, "email_sent", "email", updated.id, {
      applicationId: updated.applicationId,
      processor: "queue"
    });
    return {
      queueEntry: updated,
      status: "sent" as const,
      skipped: false
    };
  } catch (error) {
    const finalStatus = nextAttempt >= 3 ? "failed" : "queued";
    const updated = await prisma.emailQueue.update({
      where: { id: queueEntry.id },
      data: {
        status: finalStatus,
        attempts: nextAttempt,
        errorMessage: error instanceof Error ? error.message : "Email delivery failed."
      }
    });
    await captureFailureLog({
      scope: "email.delivery",
      action: "messaging_failure",
      userId: userId ?? null,
      entityType: "email",
      entityId: updated.id,
      error,
      details: {
        toEmail: updated.toEmail,
        attempts: nextAttempt
      }
    });
    await logAction(userId ?? null, finalStatus === "failed" ? "email_failed" : "email_retry_queued", "email", updated.id, {
      applicationId: updated.applicationId,
      attempts: nextAttempt
    });
    return {
      queueEntry: updated,
      status: finalStatus,
      skipped: false
    };
  }
}

export async function processQueuedEmailBatch(userId?: string | null, limit = 20) {
  const queuedEntries = await prisma.emailQueue.findMany({
    where: {
      status: { in: ["queued", "failed"] },
      attempts: { lt: 3 }
    },
    orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
    take: limit
  });

  const result = {
    processed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    skipped: 0
  };

  for (const entry of queuedEntries) {
    const output = await sendEmailQueueEntry(entry.id, userId ?? null);
    result.processed += 1;
    if (output.skipped) {
      result.skipped += 1;
      continue;
    }
    if (output.status === "sent") {
      result.sent += 1;
      continue;
    }
    if (output.status === "queued") {
      result.retried += 1;
      continue;
    }
    result.failed += 1;
  }

  return result;
}

export async function queueOrSendEmail(input: EmailInput) {
  const configured = isEmailProviderConfigured();
  const email = await prisma.emailQueue.create({
    data: {
      applicationId: input.applicationId,
      applicantMessageId: input.applicantMessageId,
      toEmail: input.toEmail,
      subject: input.subject,
      body: input.body,
      provider: getEmailProvider() || null,
      status: "queued",
      attempts: 0,
      errorMessage: configured ? null : "Email provider not configured. Message queued for future delivery."
    }
  });

  if (configured) {
    await sendEmailQueueEntry(email.id, input.userId ?? null);
  }

  const refreshed = await prisma.emailQueue.findUniqueOrThrow({ where: { id: email.id } });
  await logAction(
    input.userId ?? null,
    refreshed.status === "sent" ? "email_sent" : refreshed.status === "failed" ? "email_failed" : "email_queued",
    "email",
    email.id,
    {
    applicationId: input.applicationId,
    providerConfigured: configured,
    status: refreshed.status
    }
  );

  return refreshed;
}

export async function createApplicantMessageWithEmail({
  applicationId,
  senderId,
  senderRole,
  templateKey,
  subject,
  body,
  visibleToApplicant = true,
  userIdForAudit
}: {
  applicationId: string;
  senderId?: string | null;
  senderRole: "applicant" | "hr" | "admin" | "system";
  templateKey?: string;
  subject: string;
  body: string;
  visibleToApplicant?: boolean;
  userIdForAudit?: string | null;
}) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicantProfile: { include: { user: true } } }
  });
  if (!application) throw new Error("Application not found.");

  const message = await prisma.applicantMessage.create({
    data: {
      applicationId,
      senderId,
      senderRole,
      templateKey,
      subject,
      body,
      visibleToApplicant
    }
  });

  const email = await queueOrSendEmail({
    toEmail: application.applicantProfile.user.email,
    subject,
    body,
    applicationId,
    applicantMessageId: message.id,
    userId: userIdForAudit ?? senderId ?? null
  });

  await logAction(userIdForAudit ?? senderId ?? null, "applicant_message_created", "application", applicationId, {
    templateKey,
    visibleToApplicant,
    emailQueueId: email.id
  });

  return { message, email };
}
