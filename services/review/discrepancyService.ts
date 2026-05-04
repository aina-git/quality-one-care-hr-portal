import type { FindingCategory, FindingSeverity } from "@prisma/client";
import type { ApplicationSnapshot } from "@/services/review/applicationSnapshotService";
import { combinedExtractionText } from "@/services/review/applicationSnapshotService";

export type DraftFinding = {
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  source?: string;
};

export function reviewDiscrepancies(snapshot: ApplicationSnapshot): DraftFinding[] {
  const findings: DraftFinding[] = [];
  const resumeText = combinedExtractionText(snapshot, ["resume", "application_form"]);
  const licenseText = combinedExtractionText(snapshot, ["license"]);

  for (const job of snapshot.employmentHistory) {
    if (resumeText && !resumeText.includes(job.employerName.toLowerCase())) {
      findings.push({
        category: "employment_history",
        severity: "concern",
        title: "Employer not found in uploaded document text",
        description: `${job.employerName} is confirmed in the application but was not found in extracted resume/application text.`,
        source: "employment_history"
      });
    }
    if (job.startDate && job.endDate && job.endDate < job.startDate) {
      findings.push({
        category: "employment_history",
        severity: "concern",
        title: "Employment dates are inconsistent",
        description: `${job.employerName} has an end date before the start date.`,
        source: "employment_history"
      });
    }
  }

  for (const license of snapshot.licenses) {
    if (license.expiresAt && license.expiresAt < new Date()) {
      findings.push({
        category: "license",
        severity: "critical",
        title: "License appears expired",
        description: `${license.type} license expiration date is in the past.`,
        source: "license"
      });
    }
    if (license.licenseNumber && licenseText && !licenseText.includes(license.licenseNumber.toLowerCase())) {
      findings.push({
        category: "license",
        severity: "concern",
        title: "License number mismatch",
        description: "Confirmed license number was not found in extracted license document text.",
        source: "license_document"
      });
    }
  }

  for (const field of snapshot.extractedFields) {
    if (field.status === "corrected" && field.applicantCorrectedValue && field.applicantCorrectedValue.toLowerCase() !== field.extractedValue.toLowerCase()) {
      findings.push({
        category: "document_consistency",
        severity: "warning",
        title: "Applicant corrected extracted field",
        description: `${field.fieldLabel} was corrected from "${field.extractedValue}" to "${field.applicantCorrectedValue}".`,
        source: field.sourceDocument.fileName
      });
    }
    if (field.confidence < 0.5) {
      findings.push({
        category: "document_consistency",
        severity: "warning",
        title: "Low extraction confidence",
        description: `${field.fieldLabel} was extracted with low confidence.`,
        source: field.sourceDocument.fileName
      });
    }
  }

  if (snapshot.certifications.length > 0 && !snapshot.documents.some((doc) => /certificate|cpr|training/i.test(`${doc.detectedDocumentType} ${doc.documentType}`))) {
    findings.push({
      category: "certification",
      severity: "concern",
      title: "Certification lacks supporting document",
      description: "A certification is confirmed, but no certificate-type uploaded document was detected.",
      source: "certification"
    });
  }

  return findings;
}
