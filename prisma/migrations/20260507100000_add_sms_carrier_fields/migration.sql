-- Adds SMS-via-email gateway support to ApplicantProfile so we can
-- text status updates to applicants until a real SMS provider is wired in.

ALTER TABLE "ApplicantProfile"
  ADD COLUMN "phoneCarrier" TEXT,
  ADD COLUMN "smsEmailOverride" TEXT,
  ADD COLUMN "notificationOptIn" BOOLEAN NOT NULL DEFAULT true;
