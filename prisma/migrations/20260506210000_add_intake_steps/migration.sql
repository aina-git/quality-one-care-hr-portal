-- IntakeStep: per-application progress on the multi-step applicant intake wizard.
-- One row per (applicationId, stepKey). Holds form data as JSON, plus signature,
-- refusal, OCR-from-upload bookkeeping, and FK to the uploaded PDF if applicant
-- chose to upload instead of typing.

CREATE TYPE "IntakeStepKey" AS ENUM (
  'application_form',
  'hep_b_declination',
  'flu_declination',
  'job_description',
  'wage_deduction',
  'physical_health',
  'character_reference',
  'direct_deposit',
  'w9',
  'w4',
  'mw507',
  'skills_checklist',
  'pre_employment_test',
  'application_updates',
  'new_hire_checklist'
);

CREATE TYPE "IntakeStepStatus" AS ENUM (
  'not_started',
  'in_progress',
  'completed',
  'refused',
  'skipped'
);

CREATE TABLE "IntakeStep" (
  "id"                 TEXT             NOT NULL,
  "applicationId"      TEXT             NOT NULL,
  "stepKey"            "IntakeStepKey"  NOT NULL,
  "status"             "IntakeStepStatus" NOT NULL DEFAULT 'not_started',
  "data"               JSONB,
  "signatureName"      TEXT,
  "signatureSignedAt"  TIMESTAMP(3),
  "attachedDocumentId" TEXT,
  "ocrCompletedAt"     TIMESTAMP(3),
  "refusedAt"          TIMESTAMP(3),
  "completedAt"        TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "IntakeStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntakeStep_applicationId_stepKey_key" ON "IntakeStep" ("applicationId", "stepKey");
CREATE INDEX "IntakeStep_applicationId_idx" ON "IntakeStep" ("applicationId");
CREATE INDEX "IntakeStep_status_idx" ON "IntakeStep" ("status");

ALTER TABLE "IntakeStep"
  ADD CONSTRAINT "IntakeStep_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntakeStep"
  ADD CONSTRAINT "IntakeStep_attachedDocumentId_fkey"
  FOREIGN KEY ("attachedDocumentId") REFERENCES "UploadedDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
