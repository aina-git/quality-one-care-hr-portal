-- Tracks whether the contact info on an applicant is a placeholder filled in
-- by HR/Admin or a real applicant-provided value. Used to keep a persistent
-- "please confirm your real phone/email" prompt up until they update it.

ALTER TABLE "ApplicantProfile"
  ADD COLUMN "phoneIsTemporary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailIsTemporary" BOOLEAN NOT NULL DEFAULT false;
