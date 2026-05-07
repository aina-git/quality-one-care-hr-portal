import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { queueOrSendEmail } from "@/services/notifications/emailService";
import { resolveSmsEmailAddress, trimForSms } from "@/services/notifications/smsGateway";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://quality-one-care-hr-portal-production.up.railway.app";

export function generateTemporaryPassword(): string {
  // 10-char alphanumeric, easy-to-read (no 0/O/1/l/I).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(10);
  if (typeof crypto !== "undefined") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/**
 * Send a freshly-created applicant their login URL + temporary password via
 * email and (when carrier+phone are known) SMS-via-email gateway. Best
 * effort — never throws so account creation can't fail because the SMS
 * gateway timed out.
 */
export async function deliverApplicantLoginCredentials(opts: {
  userId: string;
  toEmail: string | null;
  phone: string | null;
  phoneCarrier: string | null;
  smsEmailOverride: string | null;
  temporaryPassword: string;
  applicantFirstName?: string | null;
}): Promise<{ emailSent: boolean; smsSent: boolean; smsAddress: string | null }> {
  const greeting = opts.applicantFirstName ? `Hi ${opts.applicantFirstName},` : "Hi,";
  const portal = `${APP_URL}/login`;

  const emailSubject = "Quality One Care — Your applicant login details";
  const emailBody = `${greeting}

Your Quality One Care applicant account is ready. Sign in to begin your application packet.

Login URL: ${portal}
Email: ${opts.toEmail ?? "(see SMS)"}
Temporary password: ${opts.temporaryPassword}

When you sign in, your application wizard will guide you through the new-hire forms one short step at a time. You can pause and come back any time.

For your security, please change your password from the dashboard once you're signed in.

— Quality One Care HR
${APP_URL}`;

  const smsBody = trimForSms(`Quality One Care: Your applicant login is ready.\nLogin: ${portal}\nUser: ${opts.toEmail ?? opts.phone}\nTemp pass: ${opts.temporaryPassword}\nChange it after sign-in.`);

  let emailSent = false;
  let smsSent = false;
  let smsAddress: string | null = null;

  // Email
  if (opts.toEmail) {
    try {
      await queueOrSendEmail({
        toEmail: opts.toEmail,
        subject: emailSubject,
        body: emailBody,
        userId: opts.userId
      });
      emailSent = true;
    } catch (err) {
      await logAction(opts.userId, "credential_email_dispatch_failed", "user", opts.userId, {
        error: err instanceof Error ? err.message : "Unknown"
      });
    }
  }

  // SMS via email-to-SMS gateway
  smsAddress = resolveSmsEmailAddress({
    phone: opts.phone,
    phoneCarrier: opts.phoneCarrier,
    smsEmailOverride: opts.smsEmailOverride
  });
  if (smsAddress) {
    try {
      await queueOrSendEmail({
        toEmail: smsAddress,
        subject: "QOC",
        body: smsBody,
        userId: opts.userId
      });
      smsSent = true;
    } catch (err) {
      await logAction(opts.userId, "credential_sms_dispatch_failed", "user", opts.userId, {
        smsAddress,
        error: err instanceof Error ? err.message : "Unknown"
      });
    }
  }

  await logAction(opts.userId, "credentials_delivered", "user", opts.userId, {
    emailSent,
    smsSent,
    channel: smsSent && emailSent ? "both" : smsSent ? "sms" : emailSent ? "email" : "none"
  });

  return { emailSent, smsSent, smsAddress };
}

/**
 * Build a synthetic email address for an applicant who registered with phone
 * only. Used as the User.email primary key (the field is required and unique).
 * The applicant can update their real email later from the dashboard, at
 * which point we'll keep the audit trail of the synthetic prior value.
 */
export function syntheticEmailFromPhone(phoneDigits: string): string {
  return `phone-${phoneDigits}@phone.qualityonecare.local`;
}

export function isSyntheticEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.endsWith("@phone.qualityonecare.local"));
}

export async function nextSyntheticEmailIfTaken(baseDigits: string): Promise<string> {
  let candidate = syntheticEmailFromPhone(baseDigits);
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { email: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `phone-${baseDigits}-${suffix}@phone.qualityonecare.local`;
  }
  return candidate;
}
