import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { mapConfirmedField } from "@/services/intake/mappingService";
import { validateApplication } from "@/services/validation/applicationValidationService";

const labels: Record<string, { label: string; section: string }> = {
  name: { label: "Name", section: "Personal Info" },
  dateOfBirth: { label: "Date of Birth", section: "Personal Info" },
  phone: { label: "Phone", section: "Personal Info" },
  email: { label: "Email", section: "Personal Info" },
  address: { label: "Address", section: "Personal Info" },
  employerName: { label: "Employer Name", section: "Employment History" },
  jobTitle: { label: "Job Title", section: "Employment History" },
  startDate: { label: "Start Date", section: "Employment History" },
  endDate: { label: "End Date", section: "Employment History" },
  supervisorName: { label: "Supervisor Name", section: "Employment History" },
  supervisorPhone: { label: "Supervisor Phone", section: "Employment History" },
  reasonForLeaving: { label: "Reason for Leaving", section: "Employment History" },
  hasPediatricExperience: { label: "Has Pediatric Experience", section: "Pediatric Experience" },
  skilledNursingExperience: { label: "Skilled Nursing Experience", section: "Pediatric Experience" },
  homeHealthExperience: { label: "Home Health Experience", section: "Pediatric Experience" },
  pediatricCareDuties: { label: "Pediatric Care Duties", section: "Pediatric Experience" },
  licenseType: { label: "License Type", section: "Licenses" },
  licenseNumber: { label: "License Number", section: "Licenses" },
  issuingState: { label: "Issuing State", section: "Licenses" },
  issueDate: { label: "Issue Date", section: "Licenses" },
  expirationDate: { label: "Expiration Date", section: "Licenses" },
  certificationType: { label: "Certification Type", section: "Certifications" },
  resume: { label: "Resume", section: "Documents" },
  scannedApplicationPage: { label: "Scanned Application Page", section: "Documents" },
  idFront: { label: "ID Front", section: "Documents" },
  idBack: { label: "ID Back", section: "Documents" },
  cpr: { label: "CPR", section: "Documents" },
  tbTest: { label: "TB Test", section: "Documents" },
  physical: { label: "Physical", section: "Documents" },
  trainingCertificate: { label: "Training Certificate", section: "Documents" },
  otherSupportingDocument: { label: "Other Supporting Document", section: "Documents" },
  referenceName: { label: "Reference Name", section: "References" },
  referencePhone: { label: "Reference Phone", section: "References" },
  referenceEmail: { label: "Reference Email", section: "References" },
  relationship: { label: "Relationship", section: "References" },
  employer: { label: "Reference Employer", section: "References" }
};

export async function POST(request: Request) {
  const user = await requireRole(["applicant"]);
  const body = await request.json().catch(() => ({}));
  const fieldKey = String(body.fieldKey ?? "");
  const value = String(body.value ?? "").trim();
  const meta = labels[fieldKey];
  if (!meta || !value) return NextResponse.json({ error: "Choose a field and enter a value." }, { status: 400 });

  const { application } = await getOrCreateApplicantApplication(user.id);
  let document = await prisma.uploadedDocument.findFirst({ where: { applicationId: application.id, documentType: "Manual Entry" } });
  if (!document) {
    document = await prisma.uploadedDocument.create({
      data: {
        applicantProfileId: application.applicantProfileId,
        applicationId: application.id,
        documentType: "Manual Entry",
        fileName: "Manual Entry",
        storageKey: "manual-entry",
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
      documentTypeDetected: "manual_entry",
      confidence: 1,
      rawText: "Manual applicant entry",
      extractedJson: { fieldKey, value }
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
      status: "corrected"
    }
  });
  await mapConfirmedField(field.id);
  await validateApplication(application.id, user.id);
  return NextResponse.json({ field });
}
