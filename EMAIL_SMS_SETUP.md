# Email + SMS-via-email gateway — Railway setup

This doc lives at the repo root for one reason: the wiring is done in code, but it can't actually deliver mail until Railway has the right env vars set. Here's what you set, and what happens when you do.

## TL;DR — Set these 3 Railway env vars

| Variable | Value | Required? |
|---|---|---|
| `EMAIL_PROVIDER` | `resend` | ✅ |
| `EMAIL_API_KEY` | your Resend API key | ✅ |
| `EMAIL_FROM` | `noreply@qualityonecare.com` (or whatever sending address you've verified at the provider) | ✅ |
| `NEXT_PUBLIC_APP_URL` | `https://quality-one-care-hr-portal-production.up.railway.app` | recommended (used in email links) |

After you set these and Railway redeploys, **every status change fires both a real email and a free SMS via the carrier's email-to-SMS gateway** — no SMS provider account needed yet.

## Step-by-step: Set up Resend (5 minutes, free 3K/month)

1. Sign up at https://resend.com (free tier: 3,000 emails/month, 100/day, plenty for HR)
2. Verify your sending domain (`qualityonecare.com`) by adding the DNS records Resend gives you. If you don't own DNS, use the throwaway-but-real `onboarding@resend.dev` for now and switch to your domain when DNS is set up.
3. Create an API key (Resend Dashboard → API Keys → Create)
4. In Railway → your service → Variables → click **+ New Variable** for each:
   - `EMAIL_PROVIDER` = `resend`
   - `EMAIL_API_KEY` = the key from step 3 (starts with `re_`)
   - `EMAIL_FROM` = `noreply@qualityonecare.com` once your domain is verified, or `onboarding@resend.dev` while you're testing
5. Save → Railway redeploys automatically (~5 min)

That's it. The next status change on any application will trigger a real email + a real SMS.

## Alternative: SendGrid

The code already supports SendGrid — set `EMAIL_PROVIDER=sendgrid` and `EMAIL_API_KEY=SG....` instead. SendGrid free tier is 100/day forever.

## How SMS-via-email works

When you set up Resend (or SendGrid) you get email delivery. The applicant's phone notifications use the same email pipeline — we just send the email to the carrier's SMS gateway, which forwards it as a free SMS.

For example: an AT&T applicant whose phone is `301-555-1234` gets text messages because we send an email to `3015551234@txt.att.net`.

The applicant picks their carrier from a dropdown on the dashboard (Notification Preferences card → Mobile carrier). The carriers we support out of the box:

- AT&T, Verizon, T-Mobile, Sprint, Boost, US Cellular, Cricket, Metro PCS, Google Voice, Xfinity Mobile, Mint Mobile, Straight Talk, TracFone

If their carrier isn't listed, they can paste a custom gateway address into the "Custom SMS-to-email address (advanced)" field.

## Migration plan to a real SMS provider next week

When you're ready to move to a paid SMS provider (Twilio, MessageBird, etc.):

1. Add the new provider's lib + a `sendSms()` function in `services/notifications/`
2. In `services/notifications/applicantStatusNotifier.ts`, swap the `queueOrSendEmail` call for the SMS portion to your new `sendSms()`
3. Keep the email-gateway path as a fallback for users without a confirmed mobile number

The data stays the same — `phone`, `phoneCarrier`, `smsEmailOverride`, `notificationOptIn` on `ApplicantProfile`.

## What gets sent — per status

These are the templates already wired in (see `services/notifications/applicantStatusNotifier.ts`):

| Status | Email | SMS |
|---|---|---|
| `submitted` / `resubmitted` | "Application received" | "We've received your application. HR review starts shortly." |
| `hr_review_pending` / `hr_review_started` | "HR review has started" | "HR has started reviewing your application." |
| `correction_requested` (and siblings) | "Action required on your application" | "ACTION NEEDED. HR has requested updates." |
| `ready_for_verification` / `verification_pending` | "Verification stage starting" | "HR review complete. Credentials being verified." |
| `verification_passed` | "Credentials verified" | "Credentials verified. File going to DON." |
| `ready_for_don_review` / `don_review*` | "Awaiting final DON approval" | "Your file is with the Director of Nursing." |
| `don_approved` / `approved` | "Application APPROVED" | "APPROVED! HR will follow up with onboarding." |
| `don_rejected` / `rejected` / `final_not_approved` | "Application decision" | "A decision has been recorded. Open the portal." |
| `ready_for_interview` | "Interview ready" | "You've been moved to the interview stage." |

Internal statuses (`ai_analysis_in_progress`, `verification_in_progress` mid-stream) intentionally don't fire — they're transient.

## Testing without spam

Until DNS / SMTP is set up, leave `EMAIL_PROVIDER` unset. The app will queue every email in the `EmailQueue` table with status `queued`. You can inspect rows in Prisma Studio to confirm content is correct, then flip the env var when you're ready to deliver.

## Audit trail

Every send (email + SMS) is logged in `AuditLog` with action `applicant_status_notified` and the queue row IDs. Failed sends log `applicant_email_dispatch_failed` or `applicant_sms_dispatch_failed`. Visible at `/admin/audit`.
