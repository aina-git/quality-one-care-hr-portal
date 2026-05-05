import { PrismaClient, Role, VerificationCategory, VerificationItemStatus } from "@prisma/client";
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

// Standard 15-item verification catalog — must mirror defaultVerificationItems in
// services/verification/verificationService.ts. Used here only for seeding the
// pre-approved demo applicant so the print page renders fully populated.
const demoChecklistItems: Array<{
  category: VerificationCategory;
  title: string;
  requirement: string;
  result: string;
  source: string;
  notes: string;
  externalReferenceNumber?: string;
  expirationDays?: number;
  status?: VerificationItemStatus;
}> = [
  { category: "employment_history", title: "Employment History", requirement: "At least 1 year of pediatric clinical experience within the past 2 years.", result: "3 yrs Pediatric Home Health (Demo Hospital, 2023–2026)", source: "Resume + verifications", notes: "Verified via 2 prior employer references.", expirationDays: 365 },
  { category: "professional_employment_verification", title: "2 Professional Employment Verifications", requirement: "At least 2 professional employment verifications completed.", result: "2 of 2 returned positive", source: "Reference forms", notes: "Both supervisors confirmed dates, role, and rehire eligibility." },
  { category: "character_reference", title: "Character Reference", requirement: "At least 1 character reference completed.", result: "1 of 1 returned positive", source: "Reference form", notes: "Personal reference of 5+ years confirmed." },
  { category: "background_check_cgis", title: "Background Check CGIS", requirement: "CGIS receipt for QOC, MA Provider Number 420641000.", result: "Clear", source: "CGIS portal", externalReferenceNumber: "CGIS-DEMO-420641000-09142", notes: "No disqualifying records.", expirationDays: 365 },
  { category: "oig_exclusion", title: "OIG Exclusion List", requirement: "OIG exclusion check completed.", result: "Not on exclusion list", source: "oig.hhs.gov", externalReferenceNumber: "OIG-2026-DEMO-77321", notes: "Checked against full exclusion file.", expirationDays: 30 },
  { category: "maryland_case_search", title: "Maryland Case Search", requirement: "Maryland Case Search completed.", result: "No matching records", source: "casesearch.courts.state.md.us", externalReferenceNumber: "MDCS-DEMO-2026-00882", notes: "Searched by full name + DOB." },
  { category: "nursys", title: "Nursys", requirement: "Nursys verification for RN/LPN applicants.", result: "Active, no discipline", source: "nursys.com", externalReferenceNumber: "NSYS-DEMO-RN-554021", notes: "Multistate compact license verified.", expirationDays: 365 },
  { category: "maryland_board_of_nursing", title: "Current and Active Nursing License", requirement: "Maryland Board of Nursing license current and active.", result: "Active — RN R244221", source: "Maryland Board of Nursing", externalReferenceNumber: "MBON-DEMO-R244221", notes: "Verified directly via MBON public lookup.", expirationDays: 730 },
  { category: "annual_physical_health", title: "Annual Physical Health Form", requirement: "Annual physical form on file.", result: "Cleared without restrictions", source: "Physical health form", notes: "Signed by licensed provider on file.", expirationDays: 365 },
  { category: "tb_test_or_chest_xray", title: "TB Test or Chest X-ray", requirement: "Current TB test or chest X-ray on file.", result: "Negative — 2-step PPD", source: "Lab report", notes: "Two-step PPD completed and on file.", expirationDays: 365 },
  { category: "liability_insurance_nso", title: "NSO Liability Insurance", requirement: "Liability insurance current where applicable.", result: "Active — $1M/$6M", source: "NSO certificate of insurance", externalReferenceNumber: "NSO-DEMO-882142", notes: "COI uploaded; coverage active.", expirationDays: 365 },
  { category: "cpr", title: "Current and Active CPR", requirement: "CPR certification current and active.", result: "BLS for Healthcare Providers — AHA", source: "AHA card", externalReferenceNumber: "AHA-DEMO-1099221", notes: "Issued by AHA-authorized training center.", expirationDays: 730 },
  { category: "id_or_work_authorization", title: "Current ID or Work Authorization", requirement: "Current state ID, license, green card, work authorization, or passport.", result: "MD Driver's License — current", source: "MVA / state ID", notes: "Photo ID matches profile photo cross-check.", expirationDays: 1095 },
  { category: "sanitation_training", title: "Sanitation Training", requirement: "Sanitation training completed where required.", result: "Completed online module", source: "Internal training portal", notes: "Module completion certificate on file.", expirationDays: 365 },
  { category: "final_decision", title: "Final DON Decision", requirement: "Final hiring approval reviewed and submitted by authorized DON/Admin.", result: "Approved for Hire", source: "DON workspace", notes: "All required items verified; cleared for onboarding." }
];

async function seedApprovedDemoApplicant(adminUserId: string) {
  // Account
  const password = await bcrypt.hash("DemoApproved123!", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo.approved@qualityonecare.local" },
    update: { passwordHash: password, name: "Demo Approved Nurse", role: "applicant" },
    create: {
      email: "demo.approved@qualityonecare.local",
      passwordHash: password,
      name: "Demo Approved Nurse",
      role: "applicant"
    }
  });

  // Profile
  const profile = await prisma.applicantProfile.upsert({
    where: { userId: user.id },
    update: {
      phone: "(410) 555-0144",
      state: "MD",
      city: "Baltimore",
      address: "1200 Demo Street",
      zip: "21201",
      dateOfBirth: new Date("1989-04-12"),
      pediatricExperience: "3 years Pediatric Home Health"
    },
    create: {
      userId: user.id,
      phone: "(410) 555-0144",
      state: "MD",
      city: "Baltimore",
      address: "1200 Demo Street",
      zip: "21201",
      dateOfBirth: new Date("1989-04-12"),
      pediatricExperience: "3 years Pediatric Home Health"
    }
  });

  // Approved application — every workflow timestamp populated
  const now = new Date();
  const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const application = await prisma.application.upsert({
    where: { id: "seed-approved-demo" },
    update: {
      status: "don_approved",
      currentStatus: "don_approved",
      previousStatus: "verification_passed",
      desiredRole: "Pediatric Skilled Nurse (RN)",
      submittedAt: days(14),
      applicationSubmittedAt: days(14),
      hrReviewStartedAt: days(12),
      verificationStartedAt: days(8),
      verificationCompletedAt: days(2),
      submittedToDonAt: days(2),
      donReviewStartedAt: days(1),
      donDecisionAt: now,
      lastActionById: adminUserId,
      lastActionAt: now,
      outcomeColor: "green"
    },
    create: {
      id: "seed-approved-demo",
      applicantProfileId: profile.id,
      desiredRole: "Pediatric Skilled Nurse (RN)",
      status: "don_approved",
      currentStatus: "don_approved",
      previousStatus: "verification_passed",
      submittedAt: days(14),
      applicationSubmittedAt: days(14),
      hrReviewStartedAt: days(12),
      verificationStartedAt: days(8),
      verificationCompletedAt: days(2),
      submittedToDonAt: days(2),
      donReviewStartedAt: days(1),
      donDecisionAt: now,
      lastActionById: adminUserId,
      lastActionAt: now,
      outcomeColor: "green"
    }
  });

  // License (printed in the header band of the print page)
  const existingLicense = await prisma.license.findFirst({
    where: { applicationId: application.id, type: "RN" }
  });
  if (existingLicense) {
    await prisma.license.update({
      where: { id: existingLicense.id },
      data: {
        licenseNumber: "R244221",
        issuingState: "MD",
        issueDate: days(700),
        expiresAt: new Date(now.getTime() + 540 * 24 * 60 * 60 * 1000)
      }
    });
  } else {
    await prisma.license.create({
      data: {
        applicantProfileId: profile.id,
        applicationId: application.id,
        type: "RN",
        licenseNumber: "R244221",
        issuingState: "MD",
        issueDate: days(700),
        expiresAt: new Date(now.getTime() + 540 * 24 * 60 * 60 * 1000)
      }
    });
  }

  // FinalVerificationChecklist — DON approved
  const checklist = await prisma.finalVerificationChecklist.upsert({
    where: { applicationId: application.id },
    update: {
      status: "approved_by_don",
      preparedByUserId: adminUserId,
      reviewedByUserId: adminUserId,
      approvedByUserId: adminUserId,
      donDecision: "approved_for_hire",
      donComment: "All required healthcare verifications completed and clean. Cleared for hire and onboarding.",
      submittedToDonAt: days(2),
      approvedAt: now,
      rejectedAt: null
    },
    create: {
      applicationId: application.id,
      status: "approved_by_don",
      preparedByUserId: adminUserId,
      reviewedByUserId: adminUserId,
      approvedByUserId: adminUserId,
      donDecision: "approved_for_hire",
      donComment: "All required healthcare verifications completed and clean. Cleared for hire and onboarding.",
      submittedToDonAt: days(2),
      approvedAt: now
    }
  });

  // 15 verification items, each marked verified by admin
  for (const item of demoChecklistItems) {
    const expirationDate = item.expirationDays
      ? new Date(now.getTime() + item.expirationDays * 24 * 60 * 60 * 1000)
      : null;
    await prisma.verificationChecklistItem.upsert({
      where: { checklistId_category: { checklistId: checklist.id, category: item.category } },
      update: {
        title: item.title,
        requirement: item.requirement,
        status: item.status ?? "verified",
        result: item.result,
        source: item.source,
        notes: item.notes,
        externalReferenceNumber: item.externalReferenceNumber,
        verifiedByUserId: adminUserId,
        verifiedAt: now,
        expirationDate
      },
      create: {
        checklistId: checklist.id,
        category: item.category,
        title: item.title,
        requirement: item.requirement,
        status: item.status ?? "verified",
        result: item.result,
        source: item.source,
        notes: item.notes,
        externalReferenceNumber: item.externalReferenceNumber,
        verifiedByUserId: adminUserId,
        verifiedAt: now,
        expirationDate
      }
    });
  }

  console.log("Seeded approved demo applicant: demo.approved@qualityonecare.local / DemoApproved123! (application id: seed-approved-demo)");
}

async function main() {
  // Role lineup (per Q1C decision 2026-05-04):
  //   HR  — full operational control (mapped to internal "admin" role)
  //   DON — final-approval workflow only (don_approver)
  //   CEO — read-only oversight (executive_view_only)
  //   Applicant — standard applicant access
  // super_admin_hr is intentionally NOT seeded; the role enum still exists for
  // backward compatibility but no user is granted it.
  const hrManager = await upsertStaff("hr@qualityonecare.local", "Hr123!", "Quality One Care HR Manager", "admin");
  await upsertStaff("admin@qualityonecare.local", "Admin123!", "Quality One Care HR (alt login)", "admin");
  await upsertStaff("don@qualityonecare.local", "Don123!", "Quality One Care DON", "don_approver");
  await upsertStaff("ceo@qualityonecare.local", "Ceo123!", "Quality One Care CEO", "executive_view_only");

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

  await seedApprovedDemoApplicant(hrManager.id);

  console.log("Seeded HR / DON / CEO staff, sample applicant, and pre-approved demo applicant.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
