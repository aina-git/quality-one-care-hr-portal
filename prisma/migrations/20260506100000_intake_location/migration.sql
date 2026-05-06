-- CreateTable
CREATE TABLE "IntakeLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntakeLocation_name_key" ON "IntakeLocation"("name");

-- CreateIndex
CREATE INDEX "IntakeLocation_isActive_idx" ON "IntakeLocation"("isActive");

-- AlterTable
ALTER TABLE "Application" ADD COLUMN "intakeLocationId" TEXT;

-- CreateIndex
CREATE INDEX "Application_intakeLocationId_idx" ON "Application"("intakeLocationId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_intakeLocationId_fkey" FOREIGN KEY ("intakeLocationId") REFERENCES "IntakeLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
