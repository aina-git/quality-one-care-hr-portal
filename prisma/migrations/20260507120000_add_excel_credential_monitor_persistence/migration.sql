-- Persist Excel Credential Monitor settings, the uploaded workbook, and send
-- history in Postgres so they survive Railway redeploys. Previously these were
-- stored in storage/excel-monitor/ on local disk, which is wiped on every
-- container restart, leaving the hourly job with nothing to scan.

CREATE TABLE "ExcelCredentialMonitorConfig" (
    "id"             TEXT         NOT NULL,
    "enabled"        BOOLEAN      NOT NULL DEFAULT false,
    "worksheetName"  TEXT,
    "hrCopyEmails"   TEXT[]       DEFAULT ARRAY[]::TEXT[],
    "subjectPrefix"  TEXT         NOT NULL DEFAULT 'Credential expiration notice',
    "fileName"       TEXT,
    "fileBytes"      BYTEA,
    "fileSize"       INTEGER,
    "fileUploadedAt" TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcelCredentialMonitorConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExcelCredentialMonitorSendLog" (
    "id"       TEXT         NOT NULL,
    "alertKey" TEXT         NOT NULL,
    "sentAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcelCredentialMonitorSendLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExcelCredentialMonitorSendLog_alertKey_sentAt_idx"
    ON "ExcelCredentialMonitorSendLog"("alertKey", "sentAt");
