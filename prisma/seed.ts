import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertStaff(email: string, password: string, name: string, role: Role) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, role },
    create: { email, passwordHash, name, role }
  });
}

async function main() {
  await upsertStaff("admin@qualityonecare.local", "Admin123!", "Quality One Care Admin", "admin");
  await upsertStaff("hr@qualityonecare.local", "Hr123!", "Quality One Care HR", "hr");

  const applicantPassword = await bcrypt.hash("Applicant123!", 12);
  const applicant = await prisma.user.upsert({
    where: { email: "applicant@qualityonecare.local" },
    update: { passwordHash: applicantPassword, name: "Sample Applicant", role: "applicant" },
    create: {
      email: "applicant@qualityonecare.local",
      passwordHash: applicantPassword,
      name: "Sample Applicant",
      role: "applicant"
    }
  });

  const profile = await prisma.applicantProfile.upsert({
    where: { userId: applicant.id },
    update: {},
    create: {
      userId: applicant.id,
      phone: "(555) 010-1200",
      state: "MD",
      pediatricExperience: "Initial profile created for dashboard preview."
    }
  });

  await prisma.application.upsert({
    where: { id: "seed-sample-application" },
    update: {},
    create: {
      id: "seed-sample-application",
      applicantProfileId: profile.id,
      desiredRole: "Pediatric Skilled Nurse",
      status: "submitted",
      submittedAt: new Date()
    }
  });

  console.log("Seeded Admin, HR, and sample applicant accounts.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
