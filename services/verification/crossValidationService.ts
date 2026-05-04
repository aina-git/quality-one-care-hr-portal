/**
 * Internal cross-validation: confirms an applicant's identity is consistent
 * across all uploaded documents.
 *
 * Data points compared:
 *   - Full name (app profile ↔ each extracted name field)
 *   - Date of birth (app profile ↔ each extracted DOB)
 *   - License number (entered license ↔ each extracted license number)
 *   - License type (entered license ↔ each extracted credential type)
 *   - Address (app profile ↔ each extracted address)
 *
 * Returns a structured report HR can display on the verification page.
 */

import { prisma } from "@/lib/prisma";

export type CrossValidationFinding = {
  field: "name" | "dateOfBirth" | "licenseNumber" | "licenseType" | "address";
  severity: "ok" | "warning" | "critical";
  applicationValue: string | null;
  documentValue: string | null;
  documentId: string | null;
  documentName: string | null;
  message: string;
};

export type CrossValidationReport = {
  applicationId: string;
  consistencyScore: number;       // 0–100
  totalChecks: number;
  okCount: number;
  warningCount: number;
  criticalCount: number;
  findings: CrossValidationFinding[];
  generatedAt: Date;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dateOnly(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function nameMatches(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Tolerate partial matches (one is contained in the other) — handles "Jane M Roe" vs "Jane Roe"
  return na.includes(nb) || nb.includes(na);
}

export async function runCrossValidation(applicationId: string): Promise<CrossValidationReport> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      applicantProfile: { include: { user: true } },
      licenses: true,
      extractedFields: { include: { sourceDocument: true } }
    }
  });
  if (!application) {
    throw new Error("Application not found");
  }

  const profile = application.applicantProfile;
  const appName = profile.user.name ?? "";
  const appDob = dateOnly(profile.dateOfBirth);
  const appAddress = profile.address ?? "";
  const license = application.licenses[0];
  const appLicenseNumber = license?.licenseNumber ?? "";
  const appLicenseType = license?.type ?? "";

  const findings: CrossValidationFinding[] = [];

  // Group extracted fields by document
  const byDocument = new Map<string, typeof application.extractedFields>();
  for (const field of application.extractedFields) {
    const arr = byDocument.get(field.sourceDocumentId) ?? [];
    arr.push(field);
    byDocument.set(field.sourceDocumentId, arr);
  }

  for (const [, fields] of byDocument) {
    const doc = fields[0]?.sourceDocument;
    if (!doc) continue;
    const documentName = doc.fileName;

    // Reconstruct candidate values from this document's extracted fields
    const firstField = fields.find((f) => f.fieldKey === "firstName");
    const lastField = fields.find((f) => f.fieldKey === "lastName");
    const nameField = fields.find((f) => f.fieldKey === "name");
    const dobField = fields.find((f) => f.fieldKey === "dateOfBirth");
    const licNumField = fields.find((f) => f.fieldKey === "licenseNumber");
    const licTypeField = fields.find((f) => f.fieldKey === "licenseType");
    const addrField = fields.find((f) => f.fieldKey === "address");

    const docName = nameField?.applicantCorrectedValue
      ?? nameField?.extractedValue
      ?? [firstField?.applicantCorrectedValue ?? firstField?.extractedValue, lastField?.applicantCorrectedValue ?? lastField?.extractedValue].filter(Boolean).join(" ");
    const docDob = dobField?.applicantCorrectedValue ?? dobField?.extractedValue ?? "";
    const docLicNum = licNumField?.applicantCorrectedValue ?? licNumField?.extractedValue ?? "";
    const docLicType = licTypeField?.applicantCorrectedValue ?? licTypeField?.extractedValue ?? "";
    const docAddress = addrField?.applicantCorrectedValue ?? addrField?.extractedValue ?? "";

    if (docName && appName) {
      const ok = nameMatches(appName, docName);
      findings.push({
        field: "name",
        severity: ok ? "ok" : "critical",
        applicationValue: appName,
        documentValue: docName,
        documentId: doc.id,
        documentName,
        message: ok ? "Name matches application" : "Name on document does NOT match application name"
      });
    }

    if (docDob && appDob) {
      const docDobIso = dateOnly(docDob);
      const ok = docDobIso === appDob;
      findings.push({
        field: "dateOfBirth",
        severity: ok ? "ok" : "critical",
        applicationValue: appDob,
        documentValue: docDobIso || docDob,
        documentId: doc.id,
        documentName,
        message: ok ? "Date of birth matches" : "DOB on document does NOT match application"
      });
    }

    if (docLicNum && appLicenseNumber) {
      const ok = normalize(docLicNum) === normalize(appLicenseNumber);
      findings.push({
        field: "licenseNumber",
        severity: ok ? "ok" : "warning",
        applicationValue: appLicenseNumber,
        documentValue: docLicNum,
        documentId: doc.id,
        documentName,
        message: ok ? "License number matches" : "License number differs from entered value"
      });
    }

    if (docLicType && appLicenseType) {
      const a = normalize(docLicType);
      const b = normalize(appLicenseType);
      const ok = a === b || a.includes(b) || b.includes(a);
      findings.push({
        field: "licenseType",
        severity: ok ? "ok" : "warning",
        applicationValue: appLicenseType,
        documentValue: docLicType,
        documentId: doc.id,
        documentName,
        message: ok ? "License type matches" : "Credential type appears different"
      });
    }

    if (docAddress && appAddress) {
      const a = normalize(docAddress);
      const b = normalize(appAddress);
      const ok = a === b || a.includes(b) || b.includes(a);
      findings.push({
        field: "address",
        severity: ok ? "ok" : "warning",
        applicationValue: appAddress,
        documentValue: docAddress,
        documentId: doc.id,
        documentName,
        message: ok ? "Address matches" : "Address differs from application"
      });
    }
  }

  const totalChecks = findings.length;
  const okCount = findings.filter((f) => f.severity === "ok").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const consistencyScore = totalChecks > 0 ? Math.round((okCount / totalChecks) * 100) : 100;

  return {
    applicationId,
    consistencyScore,
    totalChecks,
    okCount,
    warningCount,
    criticalCount,
    findings,
    generatedAt: new Date()
  };
}
