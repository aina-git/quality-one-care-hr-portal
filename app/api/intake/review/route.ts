import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";

export async function GET() {
  const user = await requireRole(["applicant"]);
  const { application } = await getOrCreateApplicantApplication(user.id);
  const [documents, fields, validation] = await Promise.all([
    prisma.uploadedDocument.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } }),
    prisma.extractedField.findMany({ where: { applicationId: application.id }, orderBy: [{ mappedSection: "asc" }, { createdAt: "asc" }] }),
    validateApplication(application.id, user.id)
  ]);

  return NextResponse.json({ application, documents, fields, validation });
}
