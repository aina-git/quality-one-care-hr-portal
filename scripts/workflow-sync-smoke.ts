import { SignJWT } from "jose";
import { prisma } from "../lib/prisma";
import { buildApplicantProgress } from "../services/applicantProgressService";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "development-only-change-me");

async function sessionCookie(user: { id: string; email: string; name: string | null; role: string }) {
  const token = await new SignJWT({ id: user.id, email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
  return token;
}

async function main() {
  const stamp = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `workflow-sync-${stamp}@qualityonecare.local`,
      passwordHash: "smoke-only",
      name: "Workflow Sync Applicant",
      role: "applicant",
      applicant: {
        create: {
          phone: "555-0101",
          pediatricExperience: "Yes",
          address: "123 Workflow Lane"
        }
      }
    },
    include: { applicant: true }
  });
  if (!user.applicant) throw new Error("Applicant profile was not created.");

  const application = await prisma.application.create({
    data: {
      applicantProfileId: user.applicant.id,
      status: "draft",
      currentStatus: "draft",
      desiredRole: "Home Health Aide",
      createdById: user.id,
      lastActionById: user.id,
      lastActionAt: new Date(),
      documents: {
        create: {
          applicantProfileId: user.applicant.id,
          documentType: "Resume",
          fileName: "resume.pdf",
          storageKey: `smoke/${stamp}/resume.pdf`,
          mimeType: "application/pdf",
          fileSize: 1000,
          processingStatus: "completed",
          detectedDocumentType: "resume",
          extractionConfidence: 1
        }
      },
      employmentHistory: {
        create: {
          applicantProfileId: user.applicant.id,
          employerName: "Quality Pediatric Home Care",
          roleTitle: "Care Assistant",
          pediatricCare: true
        }
      },
      references: {
        create: {
          applicantProfileId: user.applicant.id,
          name: "Reference Person",
          relationship: "Supervisor",
          phone: "555-0102"
        }
      }
    }
  });

  const csrf = `csrf-${stamp}`;
  const token = await sessionCookie(user);
  const response = await fetch("http://localhost:3000/api/application/submit", {
    method: "POST",
    headers: {
      cookie: `qoc_session=${token}; qoc_csrf=${csrf}`,
      "x-qoc-csrf": csrf,
      origin: "http://localhost:3000"
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Submit failed: ${response.status} ${body}`);
  }

  const submitted = await prisma.application.findUnique({
    where: { id: application.id },
    include: {
      hrReviewQueue: true,
      tasks: true,
      systemAlerts: true,
      notifications: true,
      documents: { select: { createdAt: true } },
      aiReviewReports: { select: { createdAt: true, status: true } },
      finalVerificationChecklist: {
        select: { status: true, updatedAt: true, submittedToDonAt: true, approvedAt: true, rejectedAt: true }
      },
      applicantMessages: { select: { createdAt: true, subject: true, body: true } },
      statusHistory: { select: { toStatus: true, createdAt: true, changedBy: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } },
      employeeOnboarding: { select: { createdAt: true, status: true } }
    }
  });
  if (!submitted) throw new Error("Submitted application missing.");
  const progress = buildApplicantProgress(submitted);

  const hr = await prisma.user.findFirst({ where: { role: { in: ["hr", "admin", "super_admin_hr"] }, isActive: true } });
  if (!hr) throw new Error("No HR/Admin user found.");
  const hrToken = await sessionCookie(hr);
  const reviewResponse = await fetch(`http://localhost:3000/hr/applications/${application.id}/open-review`, {
    headers: { cookie: `qoc_session=${hrToken}` },
    redirect: "manual"
  });

  let started = await prisma.application.findUnique({
    where: { id: application.id },
    include: { hrReviewQueue: true, tasks: true, systemAlerts: true }
  });
  for (let attempt = 0; attempt < 10 && started?.status !== "hr_review_started"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    started = await prisma.application.findUnique({
      where: { id: application.id },
      include: { hrReviewQueue: true, tasks: true, systemAlerts: true }
    });
  }
  if (!started) throw new Error("Started application missing.");

  const result = {
    applicationId: application.id,
    submitStatus: response.status,
    statusAfterSubmit: submitted.status,
    queueCreated: Boolean(submitted.hrReviewQueue),
    taskCreated: submitted.tasks.some((task) => task.category === "application_review"),
    alertCreated: submitted.systemAlerts.some((alert) => alert.category === "hr_review_pending"),
    notificationCount: submitted.notifications.length,
    applicantStageAfterSubmit: progress.activeStage.label,
    reviewPageStatus: reviewResponse.status,
    statusAfterHrOpen: started.status,
    queueStatusAfterHrOpen: started.hrReviewQueue?.status ?? null,
    taskInProgressAfterHrOpen: started.tasks.some((task) => task.category === "application_review" && task.status === "in_progress")
  };

  const failures = [
    result.statusAfterSubmit !== "hr_review_pending" && "submit did not set hr_review_pending",
    !result.queueCreated && "HR queue was not created",
    !result.taskCreated && "HR task was not created",
    !result.alertCreated && "dashboard alert was not created",
    result.notificationCount < 1 && "HR/Admin notification was not created",
    result.applicantStageAfterSubmit !== "Waiting for HR review" && "applicant wording is not Waiting for HR review",
    result.statusAfterHrOpen !== "hr_review_started" && "HR opening review did not start review",
    !result.taskInProgressAfterHrOpen && "HR task did not move in progress"
  ].filter(Boolean);

  console.log(JSON.stringify({ ok: failures.length === 0, failures, result }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().finally(async () => prisma.$disconnect());
