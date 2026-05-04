import { PrismaClient } from "@prisma/client";
import { processUploadedDocument } from "@/services/intake/intakeProcessor";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { ensureHrReviewQueueForApplication } from "@/services/workflow/hrReviewQueueService";

const prisma = new PrismaClient();

async function main() {
  const targetEmail = process.env.REPROCESS_APPLICANT_EMAIL ?? "honpassengr2@gmail.com";
  const user =
    (await prisma.user.findUnique({
      where: { email: targetEmail },
      include: { applicant: { include: { applications: { include: { documents: true } } } } }
    })) ??
    (await prisma.user.findFirst({
      where: { name: { contains: "Mattie", mode: "insensitive" } },
      include: { applicant: { include: { applications: { include: { documents: true } } } } },
      orderBy: { updatedAt: "desc" }
    }));

  if (!user?.applicant?.applications.length) {
    console.log(`No application found for ${targetEmail}.`);
    return;
  }

  const application =
    user.applicant.applications
      .filter((candidate) => candidate.documents.length > 0)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ??
    user.applicant.applications.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const actor = await prisma.user.findFirst({
    where: { role: { in: ["super_admin_hr", "admin", "hr"] }, isActive: true },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }]
  });
  const actorId = actor?.id ?? user.id;

  const documents = application.documents.filter((document) => document.documentType !== "Manual Entry");
  console.log(`Reprocessing ${documents.length} uploaded document(s) for ${user.name ?? user.email} / ${application.id}`);

  for (const document of documents) {
    await prisma.documentExtraction.deleteMany({ where: { documentId: document.id } });
    await prisma.documentProcessingJob.deleteMany({ where: { documentId: document.id } });
    await prisma.uploadedDocument.update({
      where: { id: document.id },
      data: {
        processingStatus: "pending",
        detectedDocumentType: null,
        extractionConfidence: null
      }
    });
    await processUploadedDocument(document.id, actorId);
  }

  const validation = await validateApplication(application.id, actorId);
  await ensureHrReviewQueueForApplication({ applicationId: application.id, userId: actorId, source: "ocr_reprocess" });

  const refreshed = await prisma.application.findUnique({
    where: { id: application.id },
    include: {
      documents: true,
      extractions: true,
      extractedFields: true,
      validationIssues: true,
      hrReviewQueue: true
    }
  });

  console.log(JSON.stringify({
    applicationId: application.id,
    status: refreshed?.status,
    documents: refreshed?.documents.map((document) => ({
      fileName: document.fileName,
      processingStatus: document.processingStatus,
      detectedDocumentType: document.detectedDocumentType,
      confidence: document.extractionConfidence
    })),
    extractionCount: refreshed?.extractions.length,
    extractedFieldCount: refreshed?.extractedFields.length,
    validation: {
      canSubmit: validation.canSubmit,
      blockingIssues: validation.blockingIssues.map((issue) => issue.message),
      warnings: validation.warningIssues.map((issue) => issue.message)
    },
    hrReviewQueue: refreshed?.hrReviewQueue?.status ?? null
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
