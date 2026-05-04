import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/services/monitoring/errorService";

export async function getAuthorizedApplication(applicationId: string, userId: string, role: Role) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicantProfile: true }
  });
  if (!application) {
    throw new AppError("Application not found.", { statusCode: 404, code: "APPLICATION_NOT_FOUND" });
  }
  if (role === "applicant" && application.applicantProfile.userId !== userId) {
    throw new AppError("You do not have access to this application.", { statusCode: 403, code: "APPLICATION_FORBIDDEN" });
  }
  return application;
}

export async function getAuthorizedDocument(documentId: string, userId: string, role: Role) {
  const document = await prisma.uploadedDocument.findUnique({
    where: { id: documentId },
    include: { applicantProfile: true }
  });
  if (!document) {
    throw new AppError("Document not found.", { statusCode: 404, code: "DOCUMENT_NOT_FOUND" });
  }
  if (role === "applicant" && document.applicantProfile.userId !== userId) {
    throw new AppError("You do not have access to this document.", { statusCode: 403, code: "DOCUMENT_FORBIDDEN" });
  }
  return document;
}
