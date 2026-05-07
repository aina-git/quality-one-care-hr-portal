import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { queueOrSendEmail } from "@/services/notifications/emailService";
import { resolveSmsEmailAddress, trimForSms } from "@/services/notifications/smsGateway";

type StatusMessage = {
  emailSubject: string;
  emailBody: string;
  smsBody: string;
};

const APPLICANT_PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://quality-one-care-hr-portal-production.up.railway.app";

/**
 * Per-status template. We only fire emails/SMS for transitions that the
 * applicant actually cares about (skip internal HR-only statuses like
 * "ai_analysis_in_progress" that flip in seconds).
 */
function templateFor(status: ApplicationStatus, applicantFirstName: string | null): StatusMessage | null {
  const greeting = applicantFirstName ? `Hi ${applicantFirstName},` : "Hi,";
  const portalLink = `\n\nView your application: ${APPLICANT_PORTAL_URL}/applicant/dashboard`;

  switch (status) {
    case "submitted":
    case "resubmitted":
      return {
        emailSubject: "Quality One Care — Application received",
        emailBody: `${greeting}\n\nWe've received your application packet. HR will begin review shortly. We'll email and text you whenever your application moves to a new stage.${portalLink}\n\nThank you,\nQuality One Care HR`,
        smsBody: "Quality One Care: We've received your application. HR review starts shortly. You'll get updates at each stage."
      };

    case "hr_review_pending":
    case "hr_review_started":
      return {
        emailSubject: "Quality One Care — HR review has started",
        emailBody: `${greeting}\n\nHR has started reviewing your application. No action is needed from you right now — we'll reach out if anything is missing.${portalLink}\n\n— Quality One Care HR`,
        smsBody: "Quality One Care: HR has started reviewing your application. No action needed unless we contact you."
      };

    case "correction_requested":
    case "applicant_correction_required":
    case "applicant_response_required":
      return {
        emailSubject: "Quality One Care — Action required on your application",
        emailBody: `${greeting}\n\nHR has requested a correction or additional information for your application. Please open the portal, check your messages, and provide what's needed so we can keep your file moving.${portalLink}\n\n— Quality One Care HR`,
        smsBody: "Quality One Care: ACTION NEEDED. HR has requested updates on your application. Open the portal to respond."
      };

    case "ready_for_verification":
    case "verification_pending":
      return {
        emailSubject: "Quality One Care — Verification stage starting",
        emailBody: `${greeting}\n\nGood news — HR review is complete and your application is moving into the credential verification stage. We'll verify your license, background check, and other credentials. We'll let you know if anything needs your attention.${portalLink}\n\n— Quality One Care HR`,
        smsBody: "Quality One Care: HR review complete. Your credentials are now being verified."
      };

    case "verification_in_progress":
      return null; // Internal status, redundant with the prior step.

    case "verification_passed":
      return {
        emailSubject: "Quality One Care — Credentials verified",
        emailBody: `${greeting}\n\nAll your credentials have been verified. Your file will now go to the Director of Nursing for final approval. You'll hear from us with the decision.${portalLink}\n\n— Quality One Care HR`,
        smsBody: "Quality One Care: Credentials verified. File going to Director of Nursing for final approval."
      };

    case "ready_for_don_review":
    case "don_review":
    case "don_review_started":
      return {
        emailSubject: "Quality One Care — Awaiting final DON approval",
        emailBody: `${greeting}\n\nYour file is now with the Director of Nursing for final approval. You'll receive the decision as soon as it's recorded.${portalLink}\n\n— Quality One Care HR`,
        smsBody: "Quality One Care: Your file is with the Director of Nursing for final approval."
      };

    case "don_approved":
    case "approved":
      return {
        emailSubject: "Quality One Care — Application APPROVED",
        emailBody: `${greeting}\n\nCongratulations — your application has been approved. The Director of Nursing has signed off and HR will be in touch with onboarding next steps.${portalLink}\n\n— Quality One Care HR`,
        smsBody: "Quality One Care: APPROVED! Your application is approved. HR will follow up with onboarding details."
      };

    case "don_rejected":
    case "rejected":
    case "final_not_approved":
      return {
        emailSubject: "Quality One Care — Application decision",
        emailBody: `${greeting}\n\nThank you for your interest in Quality One Care. After review, we are unable to move forward with your application at this time. Please open the portal to see any notes and reach out if you have questions.${portalLink}\n\n— Quality One Care HR`,
        smsBody: "Quality One Care: Your application has a decision recorded. Please open the portal to view the notes."
      };

    case "ready_for_interview":
      return {
        emailSubject: "Quality One Care — Interview ready",
        emailBody: `${greeting}\n\nYou've been moved to the interview stage. HR will be in touch shortly to schedule.${portalLink}\n\n— Quality One Care HR`,
        smsBody: "Quality One Care: You've been moved to the interview stage. HR will reach out to schedule."
      };

    default:
      return null;
  }
}

/**
 * Send applicant-facing email + SMS gateway notifications when the
 * application transitions to a stage they care about. Uses the existing
 * EmailQueue so undeliverable messages stay queued, and respects the
 * applicant's notificationOptIn flag.
 *
 * Returns a small summary (queued IDs, channels used) for caller logging.
 * Throws nothing — failures are swallowed so they never break the lifecycle
 * transaction.
 */
export async function notifyApplicantOfStatusChange({
  applicationId,
  fromStatus,
  toStatus,
  triggeredByUserId
}: {
  applicationId: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  triggeredByUserId?: string | null;
}): Promise<{ emailQueueId: string | null; smsQueueId: string | null; skipped: boolean; reason?: string }> {
  if (fromStatus === toStatus) return { emailQueueId: null, smsQueueId: null, skipped: true, reason: "no-status-change" };

  try {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { applicantProfile: { include: { user: true } } }
    });
    if (!application) return { emailQueueId: null, smsQueueId: null, skipped: true, reason: "application-not-found" };

    const profile = application.applicantProfile;
    if (!profile.notificationOptIn) {
      return { emailQueueId: null, smsQueueId: null, skipped: true, reason: "applicant-opted-out" };
    }

    const firstName = (profile.user.name ?? "").trim().split(/\s+/)[0] || null;
    const template = templateFor(toStatus, firstName);
    if (!template) return { emailQueueId: null, smsQueueId: null, skipped: true, reason: "no-template-for-status" };

    let emailQueueId: string | null = null;
    let smsQueueId: string | null = null;

    // Email — always send if we have an address.
    if (profile.user.email) {
      try {
        const emailRow = await queueOrSendEmail({
          toEmail: profile.user.email,
          subject: template.emailSubject,
          body: template.emailBody,
          applicationId,
          userId: triggeredByUserId ?? null
        });
        emailQueueId = emailRow.id;
      } catch (err) {
        await logAction(triggeredByUserId ?? null, "applicant_email_dispatch_failed", "application", applicationId, {
          toStatus,
          error: err instanceof Error ? err.message : "Unknown"
        });
      }
    }

    // SMS via email-to-SMS gateway — best effort.
    const smsAddress = resolveSmsEmailAddress({
      phone: profile.phone,
      phoneCarrier: profile.phoneCarrier,
      smsEmailOverride: profile.smsEmailOverride
    });
    if (smsAddress) {
      try {
        const smsRow = await queueOrSendEmail({
          toEmail: smsAddress,
          subject: "QOC", // most carriers strip the subject; some show first 16 chars
          body: trimForSms(template.smsBody),
          applicationId,
          userId: triggeredByUserId ?? null
        });
        smsQueueId = smsRow.id;
      } catch (err) {
        await logAction(triggeredByUserId ?? null, "applicant_sms_dispatch_failed", "application", applicationId, {
          toStatus,
          smsAddress,
          error: err instanceof Error ? err.message : "Unknown"
        });
      }
    }

    await logAction(triggeredByUserId ?? null, "applicant_status_notified", "application", applicationId, {
      fromStatus,
      toStatus,
      emailQueueId,
      smsQueueId,
      smsChannel: smsAddress ? "email_gateway" : "none"
    });

    return { emailQueueId, smsQueueId, skipped: false };
  } catch (err) {
    // Never let notification failures bubble up — they must not roll back
    // the lifecycle transition that just succeeded.
    await logAction(triggeredByUserId ?? null, "applicant_status_notify_failed", "application", applicationId, {
      fromStatus,
      toStatus,
      error: err instanceof Error ? err.message : "Unknown"
    });
    return { emailQueueId: null, smsQueueId: null, skipped: true, reason: "exception-suppressed" };
  }
}
