import type { ValidationIssue, ValidationSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getAnalysisSettings } from "@/services/analysis/documentAnalysisProvider";

export type ValidationSummary = {
  completionPercentage: number;
  blockingIssues: ValidationIssue[];
  warningIssues: ValidationIssue[];
  resolvedIssues: ValidationIssue[];
  canSubmit: boolean;
};

type DraftIssue = {
  severity: ValidationSeverity;
  section: string;
  fieldKey?: string;
  documentId?: string | null;
  issueType: string;
  message: string;
  reason: string;
  requiredAction: string;
  responsibleParty: string;
  sources?: unknown;
  applicantNote?: string | null;
  applicantActionStatus?: string | null;
};

const manualEntryDocumentType = "Manual Entry";

function hasValue(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function detected(doc: { detectedDocumentType: string | null; documentType: string; fileName: string }, patterns: RegExp[]) {
  const text = `${doc.detectedDocumentType ?? ""} ${doc.documentType} ${doc.fileName}`;
  return patterns.some((pattern) => pattern.test(text));
}

function isScannedApplication(doc: { detectedDocumentType: string | null; documentType: string; fileName: string }) {
  return detected(doc, [/application_form/i, /application form/i, /scanned application/i]);
}

function assertionKey(fieldKey: string, issueType = "applicant_claims_present") {
  return `${fieldKey}:${issueType}`;
}

export async function validateApplication(applicationId: string, userId?: string | null): Promise<ValidationSummary> {
  const [application, settings] = await Promise.all([
    prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        applicantProfile: { include: { user: true } },
        documents: true,
        employmentHistory: true,
        licenses: true,
        certifications: true,
        references: true,
        extractedFields: { include: { sourceDocument: true } },
        fieldAssertions: true
      }
    }),
    getAnalysisSettings()
  ]);

  if (!application) throw new Error("Application not found");
  const app = application;

  const threshold = settings.confidenceThreshold;
  const issues = new Map<string, DraftIssue>();
  const assertions = new Map(app.fieldAssertions.map((item) => [assertionKey(item.fieldKey, item.issueType), item]));
  const scannedApplicationDocs = app.documents.filter(isScannedApplication);
  const manualFields = app.extractedFields.filter((field) => field.sourceDocument.documentType === manualEntryDocumentType || field.applicantConfirmed);

  function addIssue(issue: DraftIssue) {
    const documentScopedIssue = ["analysis_failed", "unreadable_document", "expired_document"].includes(issue.issueType);
    const key = `${issue.fieldKey ?? issue.section}:${issue.issueType}:${documentScopedIssue ? issue.documentId ?? "any" : "any"}`;
    const existing = issues.get(key);
    if (!existing) {
      issues.set(key, issue);
      return;
    }
    issues.set(key, {
      ...existing,
      sources: [...(Array.isArray(existing.sources) ? existing.sources : [existing.sources].filter(Boolean)), issue.sources].filter(Boolean)
    });
  }

  function mappedValueExists(fieldKey: string) {
    if (fieldKey === "firstName") return hasValue(firstName);
    if (fieldKey === "lastName") return hasValue(lastParts.join(" "));
    if (fieldKey === "phone") return hasValue(app.applicantProfile.phone);
    if (fieldKey === "email") return hasValue(app.applicantProfile.user.email);
    if (fieldKey === "address") return hasValue(app.applicantProfile.address);
    if (fieldKey === "dateOfBirth") return hasValue(app.applicantProfile.dateOfBirth);
    if (["employerName", "jobTitle", "startDate", "endDate", "supervisorName", "supervisorPhone"].includes(fieldKey)) return app.employmentHistory.length > 0;
    if (["hasPediatricExperience", "pediatricExperienceYears", "pediatricCareDuties"].includes(fieldKey)) return hasValue(app.applicantProfile.pediatricExperience);
    if (fieldKey === "licenseType") return app.licenses.some((license) => hasValue(license.type));
    if (fieldKey === "licenseNumber") return app.licenses.some((license) => hasValue(license.licenseNumber));
    if (fieldKey === "issuingState") return app.licenses.some((license) => hasValue(license.issuingState));
    if (fieldKey === "expirationDate") return app.licenses.some((license) => hasValue(license.expiresAt));
    if (["name", "relationship", "referenceName"].includes(fieldKey)) return app.references.length > 0;
    return false;
  }

  function assertionFor(fieldKey: string) {
    return assertions.get(assertionKey(fieldKey)) ?? assertions.get(assertionKey(fieldKey, "hr_review_requested"));
  }

  function extractedFor(keys: string[]) {
    return app.extractedFields.filter((field) => keys.includes(field.fieldKey));
  }

  function hasConfirmedOrHighConfidence(keys: string[]) {
    return extractedFor(keys).some((field) =>
      field.applicantConfirmed ||
      field.status === "accepted" ||
      field.status === "corrected" ||
      field.confidence >= threshold ||
      hasValue(field.applicantCorrectedValue)
    );
  }

  function sourceSummary(keys: string[]) {
    return {
      scannedApplicationDocuments: scannedApplicationDocs.map((doc) => ({ id: doc.id, fileName: doc.fileName })),
      extractedFields: extractedFor(keys).map((field) => ({
        id: field.id,
        fieldKey: field.fieldKey,
        confidence: field.confidence,
        status: field.status,
        documentId: field.sourceDocumentId,
        document: field.sourceDocumentName ?? field.sourceDocument.fileName
      })),
      assertions: app.fieldAssertions.filter((item) => keys.includes(item.fieldKey)).map((item) => ({
        id: item.id,
        note: item.note,
        status: item.status,
        sourceDocumentId: item.sourceDocumentId
      }))
    };
  }

  function addMissingIfNeeded({
    section,
    fieldKey,
    keys,
    message,
    reason,
    action,
    hasMappedValue,
    relevantDocumentPatterns = []
  }: {
    section: string;
    fieldKey: string;
    keys: string[];
    message: string;
    reason: string;
    action: string;
    hasMappedValue: boolean;
    relevantDocumentPatterns?: RegExp[];
  }) {
    const assertion = assertionFor(fieldKey);
    const supportingDoc = relevantDocumentPatterns.length
      ? app.documents.find((doc) => detected(doc, relevantDocumentPatterns))
      : undefined;
    const foundInAnySource = hasMappedValue || hasConfirmedOrHighConfidence(keys);
    if (foundInAnySource) return;
    const lowConfidenceSource = extractedFor(keys)[0];
    if (assertion || supportingDoc || lowConfidenceSource) {
      addIssue({
        severity: "warning",
        section,
        fieldKey,
        documentId: assertion?.sourceDocumentId ?? supportingDoc?.id ?? lowConfidenceSource?.sourceDocumentId ?? null,
        issueType: "hr_review_requested",
        message: `${message} - sent to HR review`,
        reason: assertion?.note ?? (lowConfidenceSource ? "The system found a possible value in uploaded material, but confidence is below the healthcare accuracy threshold." : "Applicant indicated the item is present in uploaded material or uploaded a supporting document/page."),
        requiredAction: "HR must review the source document/page, confirm the value, or request applicant correction.",
        responsibleParty: "HR",
        sources: sourceSummary(keys),
        applicantNote: assertion?.note ?? null,
        applicantActionStatus: assertion?.status ?? "supporting_document_uploaded"
      });
      return;
    }
    addIssue({
      severity: "blocking",
      section,
      fieldKey,
      issueType: "missing",
      message,
      reason,
      requiredAction: action,
      responsibleParty: "Applicant",
      sources: sourceSummary(keys)
    });
  }

  const name = app.applicantProfile.user.name?.trim() ?? "";
  const [firstName, ...lastParts] = name.split(/\s+/);
  addMissingIfNeeded({
    section: "Personal Information",
    fieldKey: "firstName",
    keys: ["firstName", "name"],
    message: "First name missing",
    reason: "No confirmed first name was found in profile, manual entries, or extracted fields.",
    action: "Enter name manually or mark the scanned application page for HR review.",
    hasMappedValue: hasValue(firstName)
  });
  addMissingIfNeeded({
    section: "Personal Information",
    fieldKey: "lastName",
    keys: ["lastName", "name"],
    message: "Last name missing",
    reason: "No confirmed last name was found in profile, manual entries, or extracted fields.",
    action: "Enter name manually or mark the scanned application page for HR review.",
    hasMappedValue: hasValue(lastParts.join(" "))
  });
  addMissingIfNeeded({
    section: "Personal Information",
    fieldKey: "phone",
    keys: ["phone"],
    message: "Phone number missing",
    reason: "No phone number was found in profile, manual entries, or extracted fields.",
    action: "Enter phone number manually or mark the scanned application page for HR review.",
    hasMappedValue: hasValue(app.applicantProfile.phone)
  });

  const resumeDoc = app.documents.find((doc) => detected(doc, [/resume/i, /\bcv\b/i]));
  if (!resumeDoc && !assertionFor("resume")) {
    addIssue({
      severity: "blocking",
      section: "Documents",
      fieldKey: "resume",
      issueType: "missing",
      message: "Resume missing",
      reason: "No uploaded document was classified or labeled as a resume.",
      requiredAction: "Upload resume, upload the resume page, or send to HR review with an explanation.",
      responsibleParty: "Applicant",
      sources: { documentsChecked: app.documents.map((doc) => ({ id: doc.id, fileName: doc.fileName, documentType: doc.documentType, detectedDocumentType: doc.detectedDocumentType })) }
    });
  }

  addMissingIfNeeded({
    section: "Employment History",
    fieldKey: "employerName",
    keys: ["employerName", "jobTitle", "startDate", "endDate", "supervisorName", "supervisorPhone"],
    message: "Employment history missing or unclear",
    reason: "No mapped employer record or reliable extracted employment history was found.",
    action: "Upload employment history page, add employer manually, or ask HR to review the scanned app.",
    hasMappedValue: app.employmentHistory.length > 0,
    relevantDocumentPatterns: [/application/i, /resume/i, /employment/i]
  });

  addMissingIfNeeded({
    section: "Experience",
    fieldKey: "hasPediatricExperience",
    keys: ["hasPediatricExperience", "pediatricExperienceYears", "pediatricCareDuties"],
    message: "Pediatric experience answer missing or unclear",
    reason: "No pediatric experience answer was found in mapped data, manual entries, or reliable extracted fields.",
    action: "Answer manually, upload the missing page, or ask HR to review the scanned app.",
    hasMappedValue: hasValue(app.applicantProfile.pediatricExperience),
    relevantDocumentPatterns: [/application/i, /resume/i, /pediatric/i]
  });

  const licensedRole = /nurse|rn|lpn|cna|skilled/i.test(app.desiredRole ?? "");
  if (licensedRole) {
    addMissingIfNeeded({
      section: "Licenses and Certifications",
      fieldKey: "licenseNumber",
      keys: ["licenseType", "licenseNumber", "issuingState", "issueDate", "expirationDate"],
      message: "License information missing or unclear",
      reason: "This role requires license information, but no mapped license or reliable extracted license data was found.",
      action: "Upload license, enter license manually, or send the license document to HR review.",
      hasMappedValue: app.licenses.length > 0,
      relevantDocumentPatterns: [/license/i, /\brn\b/i, /\blpn\b/i, /\bcna\b/i]
    });
  }

  for (const license of app.licenses) {
    if (!license.expiresAt) {
      const licenseSource = app.documents.find((doc) => detected(doc, [/license/i, /application/i, /\brn\b/i, /\blpn\b/i, /\bcna\b/i]));
      addIssue({
        severity: licenseSource ? "warning" : "blocking",
        section: "Licenses and Certifications",
        fieldKey: "expirationDate",
        issueType: "missing",
        message: "License expiration date missing",
        reason: "A license exists but no expiration date is confirmed.",
        requiredAction: licenseSource
          ? "HR must verify the expiration date from the uploaded license/application package before final verification."
          : "Enter expiration date manually or upload/mark the license source for HR review.",
        responsibleParty: licenseSource ? "HR" : "Applicant",
        documentId: licenseSource?.id ?? null,
        sources: sourceSummary(["expirationDate"])
      });
    } else if (license.expiresAt < new Date()) {
      addIssue({
        severity: "warning",
        section: "Licenses and Certifications",
        fieldKey: "expirationDate",
        issueType: "expired",
        message: "License appears expired",
        reason: "The confirmed license expiration date is in the past.",
        requiredAction: "HR must verify current license status.",
        responsibleParty: "HR",
        sources: sourceSummary(["expirationDate"])
      });
    }
  }

  addMissingIfNeeded({
    section: "References",
    fieldKey: "referenceName",
    keys: ["name", "relationship", "phone", "email", "employer"],
    message: "Reference information missing or unclear",
    reason: "No reference record or reliable extracted reference information was found.",
    action: "Add a reference manually, upload a reference document/page, or send to HR review.",
    hasMappedValue: app.references.length > 0,
    relevantDocumentPatterns: [/reference/i]
  });

  for (const field of app.extractedFields.filter((item) => item.status === "pending_review" && item.confidence < threshold)) {
    if (assertionFor(field.fieldKey)) continue;
    if (mappedValueExists(field.fieldKey)) continue;
    addIssue({
      severity: "warning",
      section: field.mappedSection,
      fieldKey: field.fieldKey,
      documentId: field.sourceDocumentId,
      issueType: "low_confidence",
      message: `${field.fieldLabel} needs applicant review`,
      reason: field.reviewReason ?? `${field.fieldLabel} confidence is below ${Math.round(threshold * 100)}%.`,
      requiredAction: "HR must verify this field against the source document. Applicant correction is needed only if HR requests it.",
      responsibleParty: "HR",
      sources: sourceSummary([field.fieldKey])
    });
  }

  const profileName = normalize(app.applicantProfile.user.name);
  const firstNameField = app.extractedFields.find((field) => field.fieldKey === "firstName");
  const lastNameField = app.extractedFields.find((field) => field.fieldKey === "lastName");
  const extractedName = normalize([
    firstNameField?.applicantCorrectedValue ?? firstNameField?.extractedValue,
    lastNameField?.applicantCorrectedValue ?? lastNameField?.extractedValue
  ].filter(Boolean).join(" "));
  const nameConfidenceReliable = (firstNameField?.confidence ?? 0) >= threshold && (lastNameField?.confidence ?? 0) >= threshold;
  if (profileName && extractedName && profileName !== extractedName && nameConfidenceReliable && !assertionFor("name")) {
    addIssue({
      severity: "blocking",
      section: "Identity Verification",
      fieldKey: "name",
      issueType: "mismatch",
      message: "Name mismatch: application vs uploaded document",
      reason: "Name extracted from an uploaded document does not match the applicant profile name.",
      requiredAction: "Applicant must correct the field or send it to HR review with an explanation.",
      responsibleParty: "Applicant",
      sources: sourceSummary(["firstName", "lastName", "name"])
    });
    if (userId) await logAction(userId, "identity_mismatch_detected", "application", applicationId, { field: "name" });
  }
  const profileDob = dateOnly(app.applicantProfile.dateOfBirth);
  const extractedDob = dateOnly(app.extractedFields.find((field) => field.fieldKey === "dateOfBirth")?.applicantCorrectedValue ?? app.extractedFields.find((field) => field.fieldKey === "dateOfBirth")?.extractedValue);
  if (profileDob && extractedDob && profileDob !== extractedDob && !assertionFor("dateOfBirth")) {
    addIssue({
      severity: "blocking",
      section: "Identity Verification",
      fieldKey: "dateOfBirth",
      issueType: "mismatch",
      message: "DOB mismatch: application vs ID/government document",
      reason: "Date of birth differs between applicant profile and uploaded document.",
      requiredAction: "Correct DOB or request HR review with source document.",
      responsibleParty: "Applicant",
      sources: sourceSummary(["dateOfBirth"])
    });
    if (userId) await logAction(userId, "identity_mismatch_detected", "application", applicationId, { field: "dateOfBirth" });
  }
  const profileAddress = normalize(app.applicantProfile.address);
  const extractedAddress = normalize(app.extractedFields.find((field) => field.fieldKey === "address")?.applicantCorrectedValue ?? app.extractedFields.find((field) => field.fieldKey === "address")?.extractedValue);
  if (profileAddress && extractedAddress && profileAddress !== extractedAddress && !assertionFor("address")) {
    addIssue({
      severity: "warning",
      section: "Identity Verification",
      fieldKey: "address",
      issueType: "mismatch",
      message: "Address mismatch: application vs ID",
      reason: "Address extracted from uploaded document differs from application address.",
      requiredAction: "Confirm current address or send to HR review.",
      responsibleParty: "Applicant",
      sources: sourceSummary(["address"])
    });
    if (userId) await logAction(userId, "identity_mismatch_detected", "application", applicationId, { field: "address" });
  }

  const failedRequiredDoc = app.documents.find((doc) => doc.processingStatus === "failed");
  if (failedRequiredDoc && !assertionFor("documentAnalysis")) {
    addIssue({
      severity: "blocking",
      section: "Documents",
      fieldKey: "documentAnalysis",
      documentId: failedRequiredDoc.id,
      issueType: "analysis_failed",
      message: `${failedRequiredDoc.fileName} analysis failed`,
      reason: "Document analysis failed or OCR could not read the document.",
      requiredAction: "Upload a clearer page, enter information manually, or send to HR review with explanation.",
      responsibleParty: "Applicant",
      sources: { document: failedRequiredDoc }
    });
  }

  for (const job of app.employmentHistory) {
    if (job.startDate && job.endDate && job.startDate > job.endDate) {
      addIssue({
        severity: "warning",
        section: "Employment History",
        fieldKey: "startDate",
        issueType: "date_inconsistency",
        message: "Employment dates appear inconsistent",
        reason: "End date is before start date.",
        requiredAction: "Applicant or HR must confirm dates.",
        responsibleParty: "Applicant",
        sources: { employmentHistoryId: job.id }
      });
    }
  }

  if (/yes|pediatric/i.test(app.applicantProfile.pediatricExperience ?? "") && !app.employmentHistory.some((job) => job.pediatricCare || /pediatric|child/i.test(job.duties ?? ""))) {
    addIssue({
      severity: "warning",
      section: "Experience",
      fieldKey: "pediatricCareDuties",
      issueType: "supporting_evidence",
      message: "Pediatric experience needs supporting detail",
      reason: "Pediatric experience is claimed, but no pediatric employer or duties were found.",
      requiredAction: "Add duties manually, upload a supporting page, or send to HR review.",
      responsibleParty: "Applicant",
      sources: sourceSummary(["pediatricCareDuties"])
    });
  }

  await prisma.validationIssue.deleteMany({ where: { applicationId } });
  await prisma.validationIssue.createMany({
    data: [...issues.values()].map((issue) => ({
      applicationId,
      severity: issue.severity,
      section: issue.section,
      fieldKey: issue.fieldKey,
      documentId: issue.documentId,
      issueType: issue.issueType,
      message: issue.message,
      reason: issue.reason,
      requiredAction: issue.requiredAction,
      responsibleParty: issue.responsibleParty,
      sourcesJson: issue.sources ?? undefined,
      applicantNote: issue.applicantNote ?? undefined,
      applicantActionStatus: issue.applicantActionStatus ?? undefined
    }))
  });

  const saved = await prisma.validationIssue.findMany({ where: { applicationId }, orderBy: { createdAt: "asc" } });
  if (userId) await logAction(userId, "application_validation_checked", "application", applicationId);

  const blockingIssues = saved.filter((issue) => issue.severity === "blocking" && !issue.resolved);
  const warningIssues = saved.filter((issue) => issue.severity === "warning" && !issue.resolved);
  const resolvedIssues = saved.filter((issue) => issue.resolved);
  const requiredChecks = ["resume", "firstName", "lastName", "phone", "employerName", "hasPediatricExperience", "licenseNumber", "referenceName"];
  const missingBlockers = new Set(blockingIssues.map((issue) => issue.fieldKey ?? issue.section));
  const completed = requiredChecks.filter((check) => !missingBlockers.has(check)).length;
  const completionPercentage = Math.max(0, Math.round((completed / requiredChecks.length) * 100));

  return {
    completionPercentage,
    blockingIssues,
    warningIssues,
    resolvedIssues,
    canSubmit: blockingIssues.length === 0
  };
}
