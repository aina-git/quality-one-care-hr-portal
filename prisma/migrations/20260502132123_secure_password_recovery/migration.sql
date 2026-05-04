-- AlterTable
ALTER TABLE "ApplicantProfile" ADD COLUMN     "dateOfBirth" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PasswordRecoveryToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "role" "Role",
    "channel" "MessageChannel" NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "resetTokenHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requestIp" TEXT,
    "requestUserAgent" TEXT,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordRecoveryToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordRecoveryToken_userId_idx" ON "PasswordRecoveryToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordRecoveryToken_identifierHash_createdAt_idx" ON "PasswordRecoveryToken"("identifierHash", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordRecoveryToken_codeHash_idx" ON "PasswordRecoveryToken"("codeHash");

-- CreateIndex
CREATE INDEX "PasswordRecoveryToken_resetTokenHash_idx" ON "PasswordRecoveryToken"("resetTokenHash");

-- CreateIndex
CREATE INDEX "PasswordRecoveryToken_expiresAt_idx" ON "PasswordRecoveryToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordRecoveryToken_requestIp_createdAt_idx" ON "PasswordRecoveryToken"("requestIp", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicantProfile_phone_idx" ON "ApplicantProfile"("phone");

-- CreateIndex
CREATE INDEX "ApplicantProfile_dateOfBirth_idx" ON "ApplicantProfile"("dateOfBirth");

-- AddForeignKey
ALTER TABLE "PasswordRecoveryToken" ADD CONSTRAINT "PasswordRecoveryToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
