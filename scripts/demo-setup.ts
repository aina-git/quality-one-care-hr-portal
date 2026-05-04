/**
 * Demo setup — creates a clean demo applicant in DRAFT state with realistic data.
 *
 * Idempotent: running it again wipes the demo applicant's data and recreates fresh.
 * Use this to rehearse the full applicant → HR → DON → onboarding flow.
 *
 * Usage:
 *   npm run demo:setup
 *
 * After running, you'll see a clear next-step guide printed to the terminal.
 * Login credentials for the demo applicant are also printed.
 */

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const DEMO_EMAIL = "demo.applicant@qualityonecare.local";
const DEMO_PASSWORD = "DemoApplicant123!";
const DEMO_NAME = "Demo Nurse Applicant";

async function clearDemoApplicant() {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    include: { applicant: { include: { applications: true } } }
  });
  if (!existing) return;
  const applicationIds = existing.applicant?.applications.map((a) => a.id) ?? [];
  if (applicationIds.length > 0) {
    await prisma.task.deleteMany({ where: { relatedApplicationId: { in: applicationIds } } });
  }
  await prisma.task.deleteMany({
    where: {
      OR: [
        { createdByUserId: existing.id },
        { assignedToUserId: existing.id },
        { relatedApplicantUserId: existing.id }
      ]
    }
  });
  await prisma.user.delete({ where: { id: existing.id } });
  console.log(`Cleared previous demo applicant (${DEMO_EMAIL}).`);
}

async function createDemoApplicant() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash,
      role: "applicant",
      isActive: true,
      applicant: {
        create: {
          phone: "443-555-0199",
          dateOfBirth: new Date("1990-05-15"),
          address: "123 Pediatric Lane",
          city: "Baltimore",
          state: "MD",
          zip: "21201",
          pediatricExperience: "Has pediatric experience: yes\nYears: 3\nDuties: G-tube care, tracheostomy management, seizure response, behavioral support for children with autism."
        }
      }
    },
    include: { applicant: true }
  });

  const profile = user.applicant;
  if (!profile) throw new Error("Profile not created");

  const application = await prisma.application.create({
    data: {
      applicantProfileId: profile.id,
      status: "draft",
      currentStatus: "draft",
      desiredRole: "RN — Pediatric Home Care",
      intakeMode: "digital",
      intakeType: "digital",
      createdById: user.id,
      lastActionById: user.id,
      lastActionAt: new Date()
    }
  });

  // Pre-fill realistic structured data so the form sections look complete
  await prisma.employmentHistory.createMany({
    data: [
      {
        applicantProfileId: profile.id,
        applicationId: application.id,
        employerName: "Mercy Children's Hospital",
        roleTitle: "Pediatric RN",
        supervisorName: "Margaret Chen, RN",
        supervisorPhone: "410-555-0140",
        duties: "Pediatric ICU care, post-surgical recovery, family education, G-tube/trach management.",
        startDate: new Date("2022-03-01"),
        endDate: new Date("2025-12-31"),
        pediatricCare: true
      },
      {
        applicantProfileId: profile.id,
        applicationId: application.id,
        employerName: "Sinai Hospital of Baltimore",
        roleTitle: "Med-Surg RN",
        supervisorName: "James Walker, RN",
        supervisorPhone: "410-555-0167",
        duties: "Adult med-surg floor, IV therapy, wound care, patient education.",
        startDate: new Date("2020-06-01"),
        endDate: new Date("2022-02-28"),
        pediatricCare: false
      }
    ]
  });

  await prisma.license.create({
    data: {
      applicantProfileId: profile.id,
      applicationId: application.id,
      type: "RN",
      licenseNumber: "R204815",
      issuingState: "MD",
      issueDate: new Date("2020-04-15"),
      expiresAt: new Date("2027-04-30")
    }
  });

  await prisma.certification.createMany({
    data: [
      {
        applicantProfileId: profile.id,
        applicationId: application.id,
        name: "BLS for Healthcare Providers",
        issuer: "American Heart Association",
        issueDate: new Date("2025-01-15"),
        expiresAt: new Date("2027-01-31")
      },
      {
        applicantProfileId: profile.id,
        applicationId: application.id,
        name: "Pediatric Advanced Life Support (PALS)",
        issuer: "American Heart Association",
        issueDate: new Date("2024-08-10"),
        expiresAt: new Date("2026-08-31")
      }
    ]
  });

  await prisma.reference.createMany({
    data: [
      {
        applicantProfileId: profile.id,
        applicationId: application.id,
        name: "Margaret Chen, RN",
        relationship: "Charge Nurse / direct supervisor",
        phone: "410-555-0140",
        email: "m.chen@mercychildrens.example",
        employer: "Mercy Children's Hospital"
      },
      {
        applicantProfileId: profile.id,
        applicationId: application.id,
        name: "Dr. Patricia Singh, MD",
        relationship: "Pediatric attending physician",
        phone: "410-555-0188",
        email: "p.singh@mercychildrens.example",
        employer: "Mercy Children's Hospital"
      }
    ]
  });

  return { user, application };
}

async function main() {
  console.log("\n🎬  Quality One Care — DEMO SETUP\n");
  console.log("Resetting any previous demo data...");
  await clearDemoApplicant();

  console.log("Creating fresh demo applicant...");
  const { user, application } = await createDemoApplicant();

  console.log("\n✓ Demo data ready.\n");
  console.log("─".repeat(60));
  console.log("DEMO LOGIN");
  console.log("─".repeat(60));
  console.log(`Email:    ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log(`Name:     ${DEMO_NAME}`);
  console.log(`App ID:   ${application.id}`);
  console.log("");
  console.log("Pre-loaded:");
  console.log("  ✓ Profile with phone, DOB, MD address, pediatric experience narrative");
  console.log("  ✓ 2 employment records (Mercy Children's, Sinai)");
  console.log("  ✓ 1 license (RN, MD, expires 2027)");
  console.log("  ✓ 2 certifications (BLS + PALS)");
  console.log("  ✓ 2 references (charge nurse + attending physician)");
  console.log("  ✓ Application status: DRAFT (ready to submit)");
  console.log("");
  console.log("─".repeat(60));
  console.log("NEXT: Follow the walkthrough at docs/DEMO_WALKTHROUGH.md");
  console.log("─".repeat(60));
  console.log("");
  console.log("Quick start:");
  console.log("  1. Make sure dev server is running: npm run dev");
  console.log("  2. Open http://localhost:3000/login");
  console.log("  3. Log in with the demo credentials above");
  console.log("  4. Open docs/DEMO_WALKTHROUGH.md and follow each step\n");
}

main()
  .catch((error) => {
    console.error("\n✗ Demo setup failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
