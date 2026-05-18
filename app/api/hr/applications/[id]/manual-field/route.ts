import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { intakeFieldMeta } from "@/lib/intakeFieldOptions";
import { prisma } from "@/lib/prisma";
import { mapConfirmedField } from "@/services/intake/mappingService";
import { validateApplication } from "@/services/validation/applicationValidationService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "super_admin_hr"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const fieldKey = String(body.fieldKey ?? "");
  const value = String(body.value ?? "").trim();
  const note = String(body.note ?? "").trim();
  const meta = intakeFieldMeta[fieldKey];

  if (!meta || !value) {
    return NextResponse.json({ error: "Choose a section field and enter the missing information." }, { status: 400 });
  }

  const application = await prisma.application.findUnique({
    where: { id },
    include: { applicantProfile: true }
  });
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  let document = await prisma.uploadedDocument.findFirst({
    where: { applicationId: application.id, documentType: "HR Manual Entry" }
  });
  if (!document) {
    document = await prisma.uploadedDocument.create({
      data: {
        applicantProfileId: application.applicantProfileId,
        applicationId: application.id,
        documentType: "HR Manual Entry",
        fileName: "HR Manual Entry",
        storageKey: `manual-entry/hr/${application.id}`,
        processingStatus: "completed",
        detectedDocumentType: "other",
        extractionConfidence: 1
      }
    });
  }

  const extraction = await prisma.documentExtraction.create({
    data: {
      documentId: document.id,
      applicationId: application.id,
      documentTypeDetected: "hr_manual_entry",
      confidence: 1,
      rawText: note ? `HR manual entry. Note: ${note}` : "HR manual entry",
      extractedJson: { fieldKey, value, note, enteredBy: user.id }
    }
  });

  const field = await prisma.extractedField.create({
    data: {
      extractionId: extraction.id,
      applicationId: application.id,
      sourceDocumentId: document.id,
      fieldKey,
      fieldLabel: meta.label,
      extractedValue: value,
      mappedSection: meta.section,
      confidence: 1,
      applicantConfirmed: true,
      applicantCorrectedValue: value,
      status: "corrected",
      reviewReason: note || "Entered by authorized HR/Admin user."
    }
  });

  await mapConfirmedField(field.id);
  await validateApplication(application.id, user.id);
  await logAction(user.id, "hr_missing_information_entered", "application", application.id, {
    fieldKey,
    fieldLabel: meta.label,
    section: meta.section,
    note
  });

  return NextResponse.json({ field });
}
