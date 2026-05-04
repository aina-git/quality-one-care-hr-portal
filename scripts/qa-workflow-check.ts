import { createHash } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import bcrypt from "bcryptjs";
import { PrismaClient, type VerificationItemStatus } from "@prisma/client";
import { storeProtectedFile } from "@/services/storage/storageService";
import { processUploadedDocument } from "@/services/intake/intakeProcessor";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { runApplicationReview } from "@/services/review/reviewOrchestrator";
import { ensureFinalVerificationChecklist, summarizeChecklist, updateVerificationItem } from "@/services/verification/verificationService";
import { transitionApplication } from "@/services/workflow/controlledWorkflowService";
import { ensureHrReviewQueueForApplication } from "@/services/workflow/hrReviewQueueService";

const prisma = new PrismaClient();

function makeImage(lines: string[]) {
  const canvas = createCanvas(1600, 2100);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 1600, 2100);
  ctx.fillStyle = "black";
  ctx.font = "42px Arial";
  lines.forEach((line, index) => ctx.fillText(line, 80, 120 + index * 70));
  return canvas.toBuffer("image/png");
}

async function upsertApplicant(email: string, name: string) {
  const passwordHash = await bcrypt.hash("Applicant123!", 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "applicant", isActive: true },
    create: { email, name, passwordHash, role: "applicant", isActive: true }
  });
  const profile = await prisma.applicantProfile.upsert({
    where: { userId: user.id },
    update: {
      phone: "4105550198",
      address: "100 Care Lane",
      city: "Baltimore",
      state: "MD",
      zip: "21201",
      pediatricExperience: "Yes - 2 years pediatric home health clinical care."
    },
    create: {
      userId: user.id,
      phone: "4105550198",
      address: "100 Care Lane",
      city: "Baltimore",
      state: "MD",
      zip: "21201",
      pediatricExperience: "Yes - 2 years pediatric home health clinical care."
    }
  });
  return { user, profile };
}

async function resetApplication(id: string) {
  await prisma.application.deleteMany({ where: { id } });
}

async function attachDocument({
  applicationId,
  applicantProfileId,
  actorId,
  fileName,
  documentType,
  lines
}: {
  applicationId: string;
  applicantProfileId: string;
  actorId: string;
  fileName: string;
  documentType: string;
  lines: string[];
}) {
  const buffer = makeImage(lines);
  const stored = await storeProtectedFile({ fileName, mimeType: "image/png", buffer });
  const document = await prisma.uploadedDocument.create({
    data: {
      applicationId,
      applicantProfileId,
      documentType,
      fileName,
      mimeType: "image/png",
      fileSize: buffer.length,
      storageKey: stored.storageKey,
      storageProvider: stored.storageProvider,
      metadataJson: { qa: true, checksum: createHash("sha256").update(buffer).digest("hex") }
    }
  });
  await processUploadedDocument(document.id, actorId);
  return document;
}

async function createWebApplication(actorId: string) {
  const { profile } = await upsertApplicant("qa.web.applicant@qualityonecare.local", "QA Web Applicant");
  await resetApplication("qa-web-application");
  const app = await prisma.application.create({
    data: {
      id: "qa-web-application",
      applicantProfileId: profile.id,
      desiredRole: "Pediatric RN",
      intakeType: "digital",
      status: "draft",
      currentStatus: "draft",
      applicationSubmittedAt: new Date(),
      submittedAt: new Date(),
      employmentHistory: {
        create: {
          applicantProfileId: profile.id,
          employerName: "Pediatric Home Health Services",
          roleTitle: "Registered Nurse",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2026-01-01"),
          supervisorName: "Nurse Supervisor",
          supervisorPhone: "4105550100",
          duties: "Pediatric skilled nursing, g-tube care, seizure monitoring, trach support.",
          pediatricCare: true
        }
      },
      licenses: {
        create: {
          applicantProfileId: profile.id,
          type: "RN",
          licenseNumber: "RN123456",
          issuingState: "MD",
          issueDate: new Date("2023-01-01"),
          expiresAt: new Date("2027-06-30")
        }
      },
      references: {
        create: {
          applicantProfileId: profile.id,
          name: "Clinical Director",
          relationship: "Supervisor",
          phone: "4105550111",
          email: "supervisor@example.com",
          employer: "Pediatric Home Health Services"
        }
      }
    }
  });

  const docTypes = [
    ["qa-resume.png", "Resume", "Resume pediatric RN 2 years pediatric home health care"],
    ["qa-cgis.png", "Background Check", "CGIS background check receipt tracking QA-CGIS-001 result clear"],
    ["qa-oig.png", "OIG", "OIG Exclusion List search result no exclusion found"],
    ["qa-case-search.png", "Maryland Case Search", "Maryland Case Search result clear"],
    ["qa-nursys.png", "Nursys", "Nursys verification RN123456 active unrestricted"],
    ["qa-license.png", "License", "Maryland Board of Nursing RN license RN123456 active expires 06/30/2027"],
    ["qa-physical.png", "Annual Physical", "Annual physical health form completed 01/10/2026"],
    ["qa-tb.png", "TB Test", "TB test negative current 01/15/2026"],
    ["qa-cpr.png", "CPR", "CPR BLS certificate active expires 06/30/2027"],
    ["qa-id.png", "ID", "Driver license current non expired work authorization verified"],
    ["qa-nso.png", "NSO Insurance", "NSO liability insurance active policy QA-NSO-001 expires 06/30/2027"]
  ] as const;
  for (const [fileName, documentType, text] of docTypes) {
    await attachDocument({ applicationId: app.id, applicantProfileId: profile.id, actorId, fileName, documentType, lines: [text] });
  }
  return app.id;
}

async function createScannedApplication(actorId: string) {
  const { profile } = await upsertApplicant("qa.scanned.applicant@qualityonecare.local", "QA Scanned Applicant");
  await resetApplication("qa-scanned-application");
  const app = await prisma.application.create({
    data: {
      id: "qa-scanned-application",
      applicantProfileId: profile.id,
      desiredRole: "Pediatric LPN",
      intakeType: "paper",
      status: "draft",
      currentStatus: "draft",
      applicationSubmittedAt: new Date(),
      submittedAt: new Date()
    }
  });
  await attachDocument({
    applicationId: app.id,
    applicantProfileId: profile.id,
    actorId,
    fileName: "qa-scanned-application-package.png",
    documentType: "Scanned Application Form",
    lines: [
      "QUALITY ONE CARE EMPLOYMENT APPLICATION",
      "First Name: QA",
      "Last Name: Scanned Applicant",
      "Phone: 4105550198",
      "Email: qa.scanned.applicant@qualityonecare.local",
      "Address: 100 Care Lane Baltimore MD 21201",
      "Position: Pediatric LPN",
      "Employer: Pediatric Home Health Services",
      "Job Title: Licensed Practical Nurse",
      "Start Date: 01/01/2024",
      "End Date: 01/01/2026",
      "Supervisor: Nurse Supervisor",
      "Pediatric experience: yes 2 years",
      "License Type: LPN",
      "License Number: LPN654321",
      "Issuing State: MD",
      "Expiration Date: 06/30/2027",
      "Reference Name: Clinical Director",
      "Relationship: Supervisor",
      "CPR active expires 06/30/2027"
    ]
  });
  await attachDocument({
    applicationId: app.id,
    applicantProfileId: profile.id,
    actorId,
    fileName: "qa-scanned-resume.png",
    documentType: "Resume",
    lines: ["Resume QA Scanned Applicant Pediatric LPN two years pediatric home health care"]
  });
  return app.id;
}

async function advanceThroughReview(applicationId: string, actorId: string) {
  await transitionApplication({
    applicationId,
    userId: actorId,
    status: "hr_review_pending",
    action: "qa_application_submitted",
    note: "QA submitted application.",
    notifyStaff: false
  });
  await ensureHrReviewQueueForApplication({ applicationId, userId: actorId, source: "qa" });
  await transitionApplication({
    applicationId,
    userId: actorId,
    status: "hr_review_started",
    action: "qa_hr_review_started",
    note: "QA HR review started.",
    notifyStaff: false
  });
  const validation = await validateApplication(applicationId, actorId);
  let review: Awaited<ReturnType<typeof runApplicationReview>> | null = null;
  try {
    review = await runApplicationReview(applicationId, actorId);
  } catch (error) {
    // Keep QA moving and report the failure below.
  }
  return { validation, review };
}

async function completeVerification(applicationId: string, actorId: string) {
  await prisma.application.update({ where: { id: applicationId }, data: { status: "approved", currentStatus: "approved" } });
  const checklist = await ensureFinalVerificationChecklist(applicationId, actorId);
  const fresh = await prisma.finalVerificationChecklist.findUnique({
    where: { id: checklist.id },
    include: { application: true, items: true }
  });
  if (!fresh) throw new Error("Checklist missing");
  for (const item of fresh.items) {
    const required = !["final_decision"].includes(item.category);
    await updateVerificationItem({
      itemId: item.id,
      userId: actorId,
      status: required ? "verified" as VerificationItemStatus : "not_applicable" as VerificationItemStatus,
      result: required ? "QA verified clear/current" : "DON decision handled separately",
      expirationDate: ["cpr", "id_or_work_authorization", "maryland_board_of_nursing", "liability_insurance_nso"].includes(item.category) ? new Date("2027-06-30") : null,
      notes: required ? "QA evidence reviewed." : "Not applicable until DON final decision."
    });
  }
  const completed = await prisma.finalVerificationChecklist.findUnique({
    where: { id: checklist.id },
    include: { application: true, items: true }
  });
  return completed ? summarizeChecklist(completed) : null;
}

async function main() {
  const actor = await prisma.user.findFirst({ where: { role: { in: ["super_admin_hr", "admin", "hr"] }, isActive: true } });
  if (!actor) throw new Error("No staff actor found.");

  const webId = await createWebApplication(actor.id);
  const scannedId = await createScannedApplication(actor.id);
  const webReview = await advanceThroughReview(webId, actor.id);
  const scannedReview = await advanceThroughReview(scannedId, actor.id);
  const webChecklist = await completeVerification(webId, actor.id);

  const applications = await prisma.application.findMany({
    where: { id: { in: [webId, scannedId, "cmood3ysi002fejo0ggxhia0q"] } },
    include: {
      applicantProfile: { include: { user: true } },
      validationIssues: true,
      documents: true,
      extractedFields: true,
      aiReviewReports: { orderBy: { createdAt: "desc" }, take: 1, include: { findings: true } },
      finalVerificationChecklist: { include: { application: true, items: true } }
    }
  });

  console.log(JSON.stringify({
    webApplication: {
      id: webId,
      canSubmit: webReview.validation.canSubmit,
      blockers: webReview.validation.blockingIssues.map((issue) => issue.message),
      warnings: webReview.validation.warningIssues.map((issue) => issue.message),
      reviewGenerated: Boolean(webReview.review),
      donReady: webChecklist?.readyForDon ?? false,
      verificationCompletion: webChecklist?.completionPercentage ?? null
    },
    scannedApplication: {
      id: scannedId,
      canSubmit: scannedReview.validation.canSubmit,
      blockers: scannedReview.validation.blockingIssues.map((issue) => issue.message),
      warnings: scannedReview.validation.warningIssues.map((issue) => issue.message),
      reviewGenerated: Boolean(scannedReview.review)
    },
    inspectedApplications: applications.map((application) => ({
      id: application.id,
      applicant: application.applicantProfile.user.name,
      status: application.status,
      documents: application.documents.length,
      extractedFields: application.extractedFields.length,
      blockingIssues: application.validationIssues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message),
      warningIssues: application.validationIssues.filter((issue) => issue.severity === "warning").map((issue) => issue.message),
      report: application.aiReviewReports[0] ? {
        status: application.aiReviewReports[0].status,
        risk: application.aiReviewReports[0].overallRiskLevel,
        recommendation: application.aiReviewReports[0].recommendation,
        criticalFindings: application.aiReviewReports[0].findings.filter((finding) => finding.severity === "critical").map((finding) => finding.title)
      } : null,
      finalVerification: application.finalVerificationChecklist ? summarizeChecklist(application.finalVerificationChecklist) : null
    }))
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
