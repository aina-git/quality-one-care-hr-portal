import { PrismaClient, Role, VerificationCategory, VerificationItemStatus, DonDecision, FinalVerificationStatus, ApplicationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

// ─── Staff seeding ──────────────────────────────────────────────────────────
async function upsertStaff(email: string, password: string, name: string, role: Role) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, role },
    create: { email, passwordHash, name, role }
  });
}

// ─── Minimal PDF generator — produces a real, valid 1-page PDF ─────────────
// Generates a printable placeholder so reviewers can preview each demo document.
function makeDemoPdf(title: string, bodyLines: string[]): Buffer {
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream =
    `BT /F1 20 Tf 72 740 Td (${escape(title)}) Tj ET\n` +
    `BT /F1 11 Tf 72 712 Td (Quality One Care Home Health Inc. - Demo Document) Tj ET\n` +
    bodyLines.map((line, i) => `BT /F1 11 Tf 72 ${680 - i * 18} Td (${escape(line)}) Tj ET`).join("\n");

  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];

  const header = `%PDF-1.4\n`;
  let body = "";
  const offsets: number[] = [0];
  let pos = Buffer.byteLength(header, "latin1");
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pos);
    const chunk = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    body += chunk;
    pos += Buffer.byteLength(chunk, "latin1");
  }
  const xrefPos = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer, "latin1");
}

const STORAGE_ROOT = path.join(process.cwd(), "storage", "protected");

async function writeStoredFile(storageKey: string, buffer: Buffer) {
  const absolutePath = path.join(STORAGE_ROOT, storageKey);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return { storageKey, fileSize: buffer.length, checksum: createHash("sha256").update(buffer).digest("hex") };
}

// ─── Demo document specs ────────────────────────────────────────────────────
type DocSpec = { documentType: string; fileName: string; title: string; lines: string[] };

const approvedDocs: DocSpec[] = [
  { documentType: "resume", fileName: "Resume_DemoApprovedNurse.pdf", title: "Resume - Demo Approved Nurse, RN",
    lines: ["Pediatric Skilled Nurse - 3 years pediatric home health", "Demo Pediatric Hospital, Baltimore MD (2023-2026)", "BSN, University of Maryland School of Nursing (2022)", "Active RN License: MD R244221"] },
  { documentType: "application_form", fileName: "Application_Form_Signed.pdf", title: "Quality One Care - Employment Application",
    lines: ["Applicant: Demo Approved Nurse", "Position applied for: Pediatric Skilled Nurse (RN)", "Date submitted: 2026-04-20", "Signed and dated by applicant."] },
  { documentType: "license", fileName: "RN_License_MD_R244221.pdf", title: "Maryland Board of Nursing - RN License",
    lines: ["Name: Demo Approved Nurse", "License Number: R244221", "Issue date: 2024-04-12   Expires: 2027-04-12", "Status: Active - No discipline on file"] },
  { documentType: "cpr", fileName: "CPR_BLS_AHA.pdf", title: "American Heart Association - BLS for Healthcare Providers",
    lines: ["Issued to: Demo Approved Nurse", "Course: Basic Life Support (BLS)", "Issue date: 2026-02-10  Valid through: 2028-02-10", "Provider card #: AHA-DEMO-1099221"] },
  { documentType: "tb_test", fileName: "TB_2-Step_PPD.pdf", title: "Two-Step PPD Tuberculosis Screening",
    lines: ["Patient: Demo Approved Nurse", "Step 1: Negative (placed 2026-03-12, read 2026-03-14)", "Step 2: Negative (placed 2026-03-26, read 2026-03-28)", "Reviewed and signed by clinic provider."] },
  { documentType: "physical", fileName: "Annual_Physical_2026.pdf", title: "Annual Physical Health Form",
    lines: ["Examined by: Family Practice Demo Clinic", "Date: 2026-03-15", "Findings: No restrictions for pediatric home health duty.", "Vital signs within normal limits."] },
  { documentType: "id", fileName: "MD_Drivers_License.pdf", title: "Maryland Driver's License (Identity Document)",
    lines: ["Name: Demo Approved Nurse", "DOB: 1989-04-12", "Issued: 2024-08-01   Expires: 2032-04-12", "Status: Current and not expired"] },
  { documentType: "background_check", fileName: "CGIS_Receipt.pdf", title: "CGIS Background Check Receipt",
    lines: ["Submitted for: QOC, MA Provider Number 420641000", "Receipt: CGIS-DEMO-420641000-09142", "Result returned: 2026-04-22 - Clear", "No disqualifying records."] },
  { documentType: "reference", fileName: "References_Combined.pdf", title: "Professional and Character References",
    lines: ["Reference 1: Dr. Demo Supervisor (former charge nurse) - Positive, rehire eligible.", "Reference 2: Demo Pediatric Hospital HR - Verified dates and role.", "Character: Demo Personal Reference of 5+ years."] }
];

const rejectedDocs: DocSpec[] = [
  { documentType: "resume", fileName: "Resume_DemoRejected.pdf", title: "Resume - Demo Rejected Applicant",
    lines: ["Applied for: Pediatric Skilled Nurse", "Last clinical role: 2019-2020 (5 years ago)", "License status not provided on resume", "No pediatric experience listed"] },
  { documentType: "application_form", fileName: "Application_Form_Rejected.pdf", title: "Quality One Care - Employment Application",
    lines: ["Applicant: Demo Rejected Applicant", "Position applied for: Pediatric Skilled Nurse", "Date submitted: 2026-04-28", "Several required fields left blank."] },
  { documentType: "id", fileName: "Expired_State_ID.pdf", title: "State ID (EXPIRED)",
    lines: ["Name: Demo Rejected Applicant", "Issued: 2018-06-01   Expires: 2024-06-01", "STATUS: EXPIRED - cannot be used for employment.", "Renewal required before hire."] },
  { documentType: "cpr", fileName: "CPR_Card_Expired.pdf", title: "CPR Card (EXPIRED)",
    lines: ["Issued to: Demo Rejected Applicant", "Issue date: 2022-01-15  Expired: 2024-01-15", "Card not renewed.", "Current CPR is required for hire."] },
  { documentType: "background_check", fileName: "CGIS_Hit_Notice.pdf", title: "CGIS Background Check - Review Required",
    lines: ["Submitted for: QOC, MA Provider Number 420641000", "Receipt: CGIS-DEMO-REJECT-44219", "Result: HIT - record requires HR review and applicant explanation.", "Cannot be cleared for direct patient care without resolution."] }
];

// ─── Verification catalog (mirrors defaultVerificationItems in service) ────
const verificationCatalog: Array<{ category: VerificationCategory; title: string; requirement: string }> = [
  { category: "employment_history", title: "Employment History", requirement: "Applicant must have at least 1 year of clinical experience involving pediatric patients within the past 2 years." },
  { category: "professional_employment_verification", title: "2 Professional Employment Verifications", requirement: "At least 2 professional employment verifications must be completed and recorded." },
  { category: "character_reference", title: "Character Reference", requirement: "At least 1 character reference must be completed and recorded." },
  { category: "background_check_cgis", title: "Background Check CGIS", requirement: "CGIS/background check receipt must be uploaded or recorded for QOC, MA Provider Number 420641000." },
  { category: "oig_exclusion", title: "OIG Exclusion List", requirement: "OIG exclusion check must be completed and result recorded." },
  { category: "maryland_case_search", title: "Maryland Case Search", requirement: "Maryland Case Search must be completed and result recorded." },
  { category: "nursys", title: "Nursys", requirement: "Nursys verification must be completed for RN/LPN applicants." },
  { category: "maryland_board_of_nursing", title: "Current and Active Nursing License", requirement: "Maryland Board of Nursing license must be current and active for RN/LPN applicants." },
  { category: "annual_physical_health", title: "Annual Physical Health Form", requirement: "Annual physical form must be uploaded or recorded." },
  { category: "tb_test_or_chest_xray", title: "TB Test or Chest X-ray", requirement: "Current TB test or chest X-ray must be uploaded or recorded." },
  { category: "liability_insurance_nso", title: "NSO Liability Insurance", requirement: "Liability insurance must be current where applicable." },
  { category: "cpr", title: "Current and Active CPR", requirement: "CPR certification must be current and active." },
  { category: "id_or_work_authorization", title: "Current ID or Work Authorization", requirement: "Applicant must have current and non-expired state ID, driver's license, green card, work authorization, or American passport." },
  { category: "sanitation_training", title: "Sanitation Training", requirement: "Sanitation training must be completed where required." },
  { category: "final_decision", title: "Final DON Decision", requirement: "Final hiring approval must be reviewed and submitted by authorized DON/Admin personnel." }
];

// ─── Cleanup: drop all current applicants so the demo starts clean ─────────
async function wipeApplicants() {
  const applicants = await prisma.user.findMany({ where: { role: "applicant" } });
  if (applicants.length === 0) return;
  for (const u of applicants) {
    await prisma.user.delete({ where: { id: u.id } });
  }
  console.log(`Cleaned ${applicants.length} prior applicant(s).`);
}

// ─── Build a fully approved applicant ───────────────────────────────────────
async function seedApprovedDemoApplicant(adminUserId: string) {
  const password = await bcrypt.hash("DemoApproved123!", 12);
  const user = await prisma.user.create({
    data: { email: "demo.approved@qualityonecare.local", passwordHash: password, name: "Demo Approved Nurse", role: "applicant" }
  });

  const profile = await prisma.applicantProfile.create({
    data: {
      userId: user.id,
      phone: "(410) 555-0144",
      state: "MD",
      city: "Baltimore",
      address: "1200 Demo Street",
      zip: "21201",
      dateOfBirth: new Date("1989-04-12"),
      pediatricExperience: "3 years pediatric home health"
    }
  });

  const now = new Date();
  const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const application = await prisma.application.create({
    data: {
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

  // Seed all 9 documents for Applicant A — files written to persistent volume
  const docRecords: Record<string, string> = {};
  for (const spec of approvedDocs) {
    const buf = makeDemoPdf(spec.title, spec.lines);
    const storageKey = `uploads/seed-approved-${spec.documentType}-${Date.now()}.pdf`;
    const stored = await writeStoredFile(storageKey, buf);
    const doc = await prisma.uploadedDocument.create({
      data: {
        applicantProfileId: profile.id,
        applicationId: application.id,
        documentType: spec.documentType,
        fileName: spec.fileName,
        storageKey: stored.storageKey,
        storageProvider: "local",
        mimeType: "application/pdf",
        fileSize: stored.fileSize,
        processingStatus: "completed",
        detectedDocumentType: spec.documentType
      }
    });
    docRecords[spec.documentType] = doc.id;
  }

  // Final verification checklist - DON approved, all 15 items verified
  const checklist = await prisma.finalVerificationChecklist.create({
    data: {
      applicationId: application.id,
      status: "approved_by_don" as FinalVerificationStatus,
      preparedByUserId: adminUserId,
      reviewedByUserId: adminUserId,
      approvedByUserId: adminUserId,
      donDecision: "approved_for_hire" as DonDecision,
      donComment: "All required healthcare verifications completed and clean. Cleared for hire and onboarding.",
      submittedToDonAt: days(2),
      approvedAt: now
    }
  });

  const approvedItemNotes: Record<VerificationCategory, { result: string; source: string; notes: string; ref?: string; expDays?: number; docType?: string }> = {
    employment_history: { result: "3 yrs Pediatric Home Health (Demo Hospital, 2023-2026)", source: "Resume + verifications", notes: "Verified via 2 prior employer references.", expDays: 365, docType: "resume" },
    professional_employment_verification: { result: "2 of 2 returned positive", source: "Reference forms", notes: "Both supervisors confirmed dates, role, and rehire eligibility.", docType: "reference" },
    character_reference: { result: "1 of 1 returned positive", source: "Reference form", notes: "Personal reference of 5+ years confirmed.", docType: "reference" },
    background_check_cgis: { result: "Clear", source: "CGIS portal", ref: "CGIS-DEMO-420641000-09142", notes: "No disqualifying records.", expDays: 365, docType: "background_check" },
    oig_exclusion: { result: "Not on exclusion list", source: "oig.hhs.gov", ref: "OIG-2026-DEMO-77321", notes: "Checked against full exclusion file.", expDays: 30 },
    maryland_case_search: { result: "No matching records", source: "casesearch.courts.state.md.us", ref: "MDCS-DEMO-2026-00882", notes: "Searched by full name + DOB." },
    nursys: { result: "Active, no discipline", source: "nursys.com", ref: "NSYS-DEMO-RN-554021", notes: "Multistate compact license verified.", expDays: 365 },
    maryland_board_of_nursing: { result: "Active - RN R244221", source: "Maryland Board of Nursing", ref: "MBON-DEMO-R244221", notes: "Verified directly via MBON public lookup.", expDays: 730, docType: "license" },
    annual_physical_health: { result: "Cleared without restrictions", source: "Physical health form", notes: "Signed by licensed provider on file.", expDays: 365, docType: "physical" },
    tb_test_or_chest_xray: { result: "Negative - 2-step PPD", source: "Lab report", notes: "Two-step PPD completed and on file.", expDays: 365, docType: "tb_test" },
    liability_insurance_nso: { result: "Active - $1M/$6M", source: "NSO certificate of insurance", ref: "NSO-DEMO-882142", notes: "COI uploaded; coverage active.", expDays: 365 },
    cpr: { result: "BLS for Healthcare Providers - AHA", source: "AHA card", ref: "AHA-DEMO-1099221", notes: "Issued by AHA-authorized training center.", expDays: 730, docType: "cpr" },
    id_or_work_authorization: { result: "MD Driver's License - current", source: "MVA / state ID", notes: "Photo ID matches profile photo cross-check.", expDays: 1095, docType: "id" },
    sanitation_training: { result: "Completed online module", source: "Internal training portal", notes: "Module completion certificate on file.", expDays: 365 },
    final_decision: { result: "Approved for Hire", source: "DON workspace", notes: "All required items verified; cleared for onboarding." }
  };

  for (const item of verificationCatalog) {
    const cfg = approvedItemNotes[item.category];
    const expirationDate = cfg.expDays ? new Date(now.getTime() + cfg.expDays * 24 * 60 * 60 * 1000) : null;
    await prisma.verificationChecklistItem.create({
      data: {
        checklistId: checklist.id,
        category: item.category,
        title: item.title,
        requirement: item.requirement,
        status: "verified" as VerificationItemStatus,
        result: cfg.result,
        source: cfg.source,
        notes: cfg.notes,
        externalReferenceNumber: cfg.ref ?? null,
        verifiedByUserId: adminUserId,
        verifiedAt: now,
        expirationDate,
        documentId: cfg.docType ? docRecords[cfg.docType] ?? null : null
      }
    });
  }

  console.log("Seeded Applicant A (approved): demo.approved@qualityonecare.local / DemoApproved123!");
}

// ─── Build a rejected applicant who failed to meet minimum requirements ────
async function seedRejectedDemoApplicant(adminUserId: string) {
  const password = await bcrypt.hash("DemoRejected123!", 12);
  const user = await prisma.user.create({
    data: { email: "demo.rejected@qualityonecare.local", passwordHash: password, name: "Demo Rejected Applicant", role: "applicant" }
  });

  const profile = await prisma.applicantProfile.create({
    data: {
      userId: user.id,
      phone: "(443) 555-0188",
      state: "MD",
      city: "Glen Burnie",
      address: "44 Demo Lane",
      zip: "21061",
      dateOfBirth: new Date("1991-09-08"),
      pediatricExperience: "No pediatric experience indicated."
    }
  });

  const now = new Date();
  const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const application = await prisma.application.create({
    data: {
      id: "seed-rejected-demo",
      applicantProfileId: profile.id,
      desiredRole: "Pediatric Skilled Nurse",
      status: "final_not_approved" as ApplicationStatus,
      currentStatus: "final_not_approved" as ApplicationStatus,
      previousStatus: "verification_issues_found" as ApplicationStatus,
      submittedAt: days(7),
      applicationSubmittedAt: days(7),
      hrReviewStartedAt: days(6),
      verificationStartedAt: days(4),
      verificationCompletedAt: days(1),
      submittedToDonAt: days(1),
      donReviewStartedAt: days(1),
      donDecisionAt: now,
      lastActionById: adminUserId,
      lastActionAt: now,
      outcomeColor: "red"
    }
  });

  // Seed only the 5 docs for Applicant B
  const docRecordsB: Record<string, string> = {};
  for (const spec of rejectedDocs) {
    const buf = makeDemoPdf(spec.title, spec.lines);
    const storageKey = `uploads/seed-rejected-${spec.documentType}-${Date.now()}.pdf`;
    const stored = await writeStoredFile(storageKey, buf);
    const doc = await prisma.uploadedDocument.create({
      data: {
        applicantProfileId: profile.id,
        applicationId: application.id,
        documentType: spec.documentType,
        fileName: spec.fileName,
        storageKey: stored.storageKey,
        storageProvider: "local",
        mimeType: "application/pdf",
        fileSize: stored.fileSize,
        processingStatus: "completed",
        detectedDocumentType: spec.documentType
      }
    });
    docRecordsB[spec.documentType] = doc.id;
  }

  // Final verification checklist - DON not approved
  const checklist = await prisma.finalVerificationChecklist.create({
    data: {
      applicationId: application.id,
      status: "rejected_by_don" as FinalVerificationStatus,
      preparedByUserId: adminUserId,
      reviewedByUserId: adminUserId,
      approvedByUserId: adminUserId,
      donDecision: "not_approved" as DonDecision,
      donComment: "Multiple required healthcare verification items failed. Background check returned a hit requiring resolution; CPR and state ID are expired; no current nursing license on file. Applicant does not meet minimum hiring requirements at this time.",
      submittedToDonAt: days(1),
      rejectedAt: now
    }
  });

  // Per-item statuses showing the failures
  const rejectedItemConfig: Record<VerificationCategory, { status: VerificationItemStatus; result: string; source: string; notes: string; ref?: string; expDays?: number; docType?: string }> = {
    employment_history: { status: "failed", result: "Last clinical role 2019-2020 - over 4 years ago", source: "Resume", notes: "Does not meet minimum requirement of 1 year clinical experience within last 2 years.", docType: "resume" },
    professional_employment_verification: { status: "needs_followup", result: "0 of 2 returned", source: "Reference forms", notes: "References listed could not be reached." },
    character_reference: { status: "pending", result: "Not yet submitted", source: "Reference form", notes: "Applicant has not provided a character reference." },
    background_check_cgis: { status: "failed", result: "HIT - record requires HR review and applicant explanation", source: "CGIS portal", ref: "CGIS-DEMO-REJECT-44219", notes: "Cannot clear for direct patient care without resolution.", docType: "background_check" },
    oig_exclusion: { status: "verified", result: "Not on exclusion list", source: "oig.hhs.gov", ref: "OIG-2026-DEMO-44218", notes: "OIG check returned clean.", expDays: 30 },
    maryland_case_search: { status: "needs_followup", result: "Match found - requires applicant explanation", source: "casesearch.courts.state.md.us", ref: "MDCS-DEMO-2026-44217", notes: "Court record match needs review by HR." },
    nursys: { status: "failed", result: "No active license found in Nursys", source: "nursys.com", notes: "Nursys returned no active multistate or single-state license under applicant's name." },
    maryland_board_of_nursing: { status: "failed", result: "License not found / lapsed", source: "Maryland Board of Nursing", notes: "MBON public lookup returned no current active license. Cannot hire as RN without current license." },
    annual_physical_health: { status: "pending", result: "Not yet submitted", source: "Physical health form", notes: "Form not provided. Required prior to hire." },
    tb_test_or_chest_xray: { status: "pending", result: "Not yet submitted", source: "Lab report", notes: "TB test or chest X-ray not provided." },
    liability_insurance_nso: { status: "not_applicable", result: "Not required at this stage", source: "n/a", notes: "Not applicable until employment is offered." },
    cpr: { status: "expired", result: "BLS card expired 2024-01-15", source: "AHA card", notes: "CPR card has lapsed. Renewal required.", expDays: 0, docType: "cpr" },
    id_or_work_authorization: { status: "expired", result: "MD State ID expired 2024-06-01", source: "State ID", notes: "Identity document expired. Renewal required prior to hire.", expDays: 0, docType: "id" },
    sanitation_training: { status: "pending", result: "Not yet completed", source: "Internal training portal", notes: "Training not completed." },
    final_decision: { status: "verified", result: "Not Approved for Hire", source: "DON workspace", notes: "DON reviewed and declined to approve based on multiple verification failures." }
  };

  for (const item of verificationCatalog) {
    const cfg = rejectedItemConfig[item.category];
    const expirationDate = cfg.expDays !== undefined
      ? (cfg.expDays <= 0 ? days(180) /* in the past */ : new Date(now.getTime() + cfg.expDays * 24 * 60 * 60 * 1000))
      : null;
    await prisma.verificationChecklistItem.create({
      data: {
        checklistId: checklist.id,
        category: item.category,
        title: item.title,
        requirement: item.requirement,
        status: cfg.status,
        result: cfg.result,
        source: cfg.source,
        notes: cfg.notes,
        externalReferenceNumber: cfg.ref ?? null,
        verifiedByUserId: adminUserId,
        verifiedAt: now,
        expirationDate,
        documentId: cfg.docType ? docRecordsB[cfg.docType] ?? null : null
      }
    });
  }

  console.log("Seeded Applicant B (rejected): demo.rejected@qualityonecare.local / DemoRejected123!");
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  // Role lineup (per Q1C decision 2026-05-04):
  //   HR  - full operational control (mapped to super_admin_hr (HR Coordinator))
  //   DON - final-approval workflow only
  //   CEO - read-only oversight
  //   Applicant - standard applicant access
  // Super Admin HR is intentionally NOT seeded.
  const hrManager = await upsertStaff("hr@qualityonecare.local", "Hr123!", "Quality One Care HR Manager", "super_admin_hr");
  await upsertStaff("admin@qualityonecare.local", "Admin123!", "Quality One Care HR (alt login)", "super_admin_hr");
  await upsertStaff("don@qualityonecare.local", "Don123!", "Quality One Care DON", "don_approver");
  await upsertStaff("ceo@qualityonecare.local", "Ceo123!", "Quality One Care CEO", "executive_view_only");

  // Wipe all current applicants so the demo starts from a clean slate, then
  // seed exactly two: one fully approved (printout demo) and one not approved
  // (shows what failure looks like).
  await wipeApplicants();
  await seedApprovedDemoApplicant(hrManager.id);
  await seedRejectedDemoApplicant(hrManager.id);

  console.log("Seeded HR / DON / CEO staff and 2 demo applicants (approved + not-approved).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
