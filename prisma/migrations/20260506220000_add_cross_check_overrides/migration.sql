-- CrossCheckOverride: HR-level resolution of identity cross-check findings.
-- One row per (applicationId, field, documentId) override. Soft-revocable via
-- revokedAt so we keep the audit trail.

CREATE TABLE "CrossCheckOverride" (
  "id"               TEXT          NOT NULL,
  "applicationId"    TEXT          NOT NULL,
  "field"            TEXT          NOT NULL,
  "documentId"       TEXT,
  "applicationValue" TEXT,
  "documentValue"    TEXT,
  "reason"           TEXT          NOT NULL,
  "overriddenById"   TEXT          NOT NULL,
  "overriddenAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"        TIMESTAMP(3),
  "revokedById"      TEXT,
  "revokedReason"    TEXT,
  "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "CrossCheckOverride_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrossCheckOverride_applicationId_idx" ON "CrossCheckOverride" ("applicationId");
CREATE INDEX "CrossCheckOverride_applicationId_field_documentId_idx" ON "CrossCheckOverride" ("applicationId", "field", "documentId");
CREATE INDEX "CrossCheckOverride_revokedAt_idx" ON "CrossCheckOverride" ("revokedAt");

ALTER TABLE "CrossCheckOverride"
  ADD CONSTRAINT "CrossCheckOverride_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrossCheckOverride"
  ADD CONSTRAINT "CrossCheckOverride_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "UploadedDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrossCheckOverride"
  ADD CONSTRAINT "CrossCheckOverride_overriddenById_fkey"
  FOREIGN KEY ("overriddenById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrossCheckOverride"
  ADD CONSTRAINT "CrossCheckOverride_revokedById_fkey"
  FOREIGN KEY ("revokedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
