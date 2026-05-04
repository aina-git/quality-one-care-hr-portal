import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export function isSmsProviderConfigured() {
  return Boolean(process.env.SMS_PROVIDER && process.env.SMS_API_KEY);
}

export function isWhatsAppProviderConfigured() {
  return Boolean(process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_API_KEY);
}

export async function queueSms({
  applicationId,
  toPhone,
  body,
  userId
}: {
  applicationId?: string | null;
  toPhone: string;
  body: string;
  userId?: string | null;
}) {
  const entry = await prisma.smsQueue.create({
    data: {
      applicationId: applicationId ?? null,
      toPhone,
      body,
      provider: process.env.SMS_PROVIDER || null,
      errorMessage: isSmsProviderConfigured() ? null : "SMS provider not configured. Message queued."
    }
  });
  await logAction(userId ?? null, "message_queued", "sms", entry.id, { applicationId });
  return entry;
}

export async function queueWhatsApp({
  applicationId,
  toPhone,
  body,
  userId
}: {
  applicationId?: string | null;
  toPhone: string;
  body: string;
  userId?: string | null;
}) {
  const entry = await prisma.whatsAppQueue.create({
    data: {
      applicationId: applicationId ?? null,
      toPhone,
      body,
      provider: process.env.WHATSAPP_PROVIDER || null,
      errorMessage: isWhatsAppProviderConfigured() ? null : "WhatsApp provider not configured. Message queued."
    }
  });
  await logAction(userId ?? null, "message_queued", "whatsapp", entry.id, { applicationId });
  return entry;
}
