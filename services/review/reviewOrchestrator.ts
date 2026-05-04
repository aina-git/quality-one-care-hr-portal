import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { getApplicationSnapshot } from "@/services/review/applicationSnapshotService";
import { reviewDiscrepancies, type DraftFinding } from "@/services/review/discrepancyService";
import { reviewPediatricExperience } from "@/services/review/pediatricExperienceReviewService";
import { reviewLicenses } from "@/services/review/licenseReviewService";
import { reviewEmployment } from "@/services/review/employmentReviewService";
import { reviewDocuments } from "@/services/review/documentConsistencyService";
import { chooseRiskAndRecommendation } from "@/services/review/recommendationService";
import { transitionApplication } from "@/services/workflow/controlledWorkflowService";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function addFinding(findings: DraftFinding[], finding: DraftFinding) {
  findings.push(finding);
}

function hasDocument(snapshot: Awaited<ReturnType<typeof getApplicationSnapshot>>, patterns: RegExp[]) {
  if (!snapshot) return false;
  return snapshot.documents.some((document) => {
    const text = `${document.fileName} ${document.documentType} ${document.detectedDocumentType ?? ""}`.toLowerCase();
    return patterns.some((pattern) => pattern.test(text));
  });
}

function addMandatoryComplianceFindings(snapshot: NonNullable<Awaited<ReturnType<typeof getApplicationSnapshot>>>, findings: DraftFinding[]) {
  const role = snapshot.desiredRole ?? "";
  const nursingRole = /\b(rn|lpn|nurse|nursing|skilled)\b/i.test(role);
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const pediatricClinicalMonths = snapshot.employmentHistory.reduce((months, job) => {
    const pediatric = job.pediatricCare || /pediatric|child|children|infant|youth|school|home health|skilled nursing/i.test(`${job.duties ?? ""} ${job.employerName}`);
    if (!pediatric || !job.startDate) return months;
    const end = job.endDate ?? new Date();
    if (end < twoYearsAgo) return months;
    return months + Math.max(1, Math.round((end.getTime() - job.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  }, 0);

  if (nursingRole && pediatricClinicalMonths < 12) {
    addFinding(findings, {
      category: "pediatric_experience",
      severity: "critical",
      title: "Pediatric clinical experience requirement not satisfied",
      description: "Nursing applicants must have at least 1 year of clinical experience involving pediatric patients within the past 2 years. Available records do not prove this requirement.",
      source: "mandatory_compliance"
    });
  }

  const supervisorReferences = snapshot.references.filter((reference) => /supervisor|manager|director|administrator|charge/i.test(`${reference.relationship ?? ""} ${reference.employer ?? ""}`));
  if (supervisorReferences.length < 1) {
    addFinding(findings, {
      category: "reference",
      severity: "concern",
      title: "Supervisor-level character reference missing",
      description: "At least one character reference should be supervisor level or higher. Current reference data does not clearly prove that standard.",
      source: "mandatory_compliance"
    });
  }

  if (snapshot.employmentHistory.length < 1) {
    addFinding(findings, {
      category: "employment_history",
      severity: "critical",
      title: "Employment history missing",
      description: "Employment history is required for clinical/pediatric care applicants and must be cross-checked against resume, application, and references.",
      source: "mandatory_compliance"
    });
  }

  const requiredDocs: Array<[string, RegExp[], DraftFinding["category"], DraftFinding["severity"]]> = [
    ["CGIS background check receipt", [/cgis|background/i], "missing_information", "critical"],
    ["Annual physical health form", [/physical|annual health/i], "certification", "critical"],
    ["TB test or chest X-ray", [/\btb\b|chest x.?ray/i], "certification", "critical"],
    ["Current CPR certification", [/\bcpr\b|bls/i], "certification", "critical"],
    ["Government ID or work authorization", [/\bid\b|id_document|driver|state id|passport|green card|work authorization|ead/i], "missing_information", "critical"],
    ["NSO or equivalent liability insurance", [/\bnso\b|liability insurance|malpractice/i], "certification", "concern"]
  ];
  for (const [title, patterns, category, severity] of requiredDocs) {
    if (!hasDocument(snapshot, patterns)) {
      addFinding(findings, {
        category,
        severity,
        title: `${title} missing`,
        description: `${title} was not detected in uploaded supporting documents. HR must request evidence or record a justified override where permitted.`,
        source: "mandatory_compliance"
      });
    }
  }

  if (nursingRole) {
    if (!hasDocument(snapshot, [/nursys/i])) {
      addFinding(findings, {
        category: "license",
        severity: "critical",
        title: "Nursys verification missing",
        description: "Nursys verification is mandatory for RN/LPN applicants and must be recorded before DON approval.",
        source: "mandatory_compliance"
      });
    }
    if (!snapshot.licenses.length) {
      addFinding(findings, {
        category: "license",
        severity: "critical",
        title: "Nursing license record missing",
        description: "A current, active nursing license is required for RN/LPN applicants.",
        source: "mandatory_compliance"
      });
    }
  }

  for (const license of snapshot.licenses) {
    if (!license.expiresAt || license.expiresAt < new Date()) {
      addFinding(findings, {
        category: "license",
        severity: "critical",
        title: "License expiration invalid or missing",
        description: "Nursing license expiration must be present, current, and active before the application can advance.",
        source: "mandatory_compliance"
      });
    }
  }
}

export async function runApplicationReview(applicationId: string, reviewerId: string) {
  const snapshot = await getApplicationSnapshot(applicationId);
  if (!snapshot) throw new Error("Application not found");
  if (snapshot.status === "draft") throw new Error("Draft applications cannot be reviewed.");

  const validation = await validateApplication(applicationId, reviewerId);
  if (validation.blockingIssues.length > 0) throw new Error("Blocking validation issues must be resolved before review.");
  const pendingLowConfidenceFields = snapshot.extractedFields.filter((field) => field.status === "pending_review");

  const previous = snapshot.aiReviewReports[0];
  const generatedBy = process.env.AI_PROVIDER && process.env.AI_API_KEY ? "provider_ready_ai_engine" : "rule_based_engine";
  const report = await prisma.aIReviewReport.create({
    data: {
      applicationId,
      status: "processing",
      generatedBy,
      generatedAt: new Date()
    }
  });

  await logAction(reviewerId, previous ? "ai_review_rerun" : "ai_review_started", "application", applicationId, { reportId: report.id });

  try {
    const fresh = await getApplicationSnapshot(applicationId);
    if (!fresh) throw new Error("Application snapshot missing.");

    const pediatric = reviewPediatricExperience(fresh);
    const license = reviewLicenses(fresh);
    const employment = reviewEmployment(fresh);
    const documents = reviewDocuments(fresh);
    const findings = reviewDiscrepancies(fresh);
    addMandatoryComplianceFindings(fresh, findings);
    for (const field of pendingLowConfidenceFields) {
      addFinding(findings, {
        category: "document_consistency",
        severity: "warning",
        title: `${field.fieldLabel} requires HR verification`,
        description: "The field was extracted with low confidence and must be verified against the uploaded source document. The system did not autofill or assume the value.",
        source: "low_confidence_extraction"
      });
    }

    if (!pediatric.hasEvidence) addFinding(findings, {
      category: "pediatric_experience",
      severity: "critical",
      title: "No pediatric experience evidence",
      description: "No confirmed pediatric or child/home-health care evidence was found.",
      source: "pediatric_review"
    });
    for (const concern of pediatric.concerns) addFinding(findings, {
      category: "pediatric_experience",
      severity: concern.includes("No pediatric") ? "critical" : "concern",
      title: "Pediatric experience concern",
      description: concern,
      source: "pediatric_review"
    });
    for (const concern of license.concerns) addFinding(findings, {
      category: "license",
      severity: concern.includes("past") ? "critical" : "concern",
      title: "License review concern",
      description: concern,
      source: "license_review"
    });
    for (const concern of employment.concerns) addFinding(findings, {
      category: "employment_history",
      severity: "concern",
      title: "Employment review concern",
      description: concern,
      source: "employment_review"
    });
    for (const missing of documents.missingExpectedDocuments) addFinding(findings, {
      category: "missing_information",
      severity: "concern",
      title: "Expected document missing",
      description: `${missing} is expected but was not detected among uploaded documents.`,
      source: "document_review"
    });
    for (const failed of documents.failedProcessingDocuments) addFinding(findings, {
      category: "document_consistency",
      severity: "critical",
      title: "Document processing failed",
      description: `${failed} could not be processed for review.`,
      source: "document_review"
    });
    for (const low of documents.lowConfidenceExtractions) addFinding(findings, {
      category: "document_consistency",
      severity: "warning",
      title: "Low confidence extraction",
      description: `${low} has low extraction confidence and should be checked by HR.`,
      source: "document_review"
    });

    const incomplete = documents.failedProcessingDocuments.length > 0 || documents.missingExpectedDocuments.length > 0;
    const recommendation = chooseRiskAndRecommendation({
      findings,
      pediatricStrength: pediatric.strengthLevel,
      licenseExpired: license.expired,
      incomplete
    });

    const strengths = [
      pediatric.hasEvidence ? pediatric.summary : null,
      employment.pediatricRelevantEmployers.length ? "Employment history includes pediatric-relevant employer data." : null,
      license.licensePresent && !license.expired ? "License record is present and not expired based on entered data." : null
    ].filter(Boolean);
    const concerns = findings.filter((finding) => finding.severity === "concern" || finding.severity === "critical").map((finding) => finding.title);
    const summary = `Machine-learning-assisted review completed by ${generatedBy}. Final approval must be completed by the authorized DON reviewer.`;

    await prisma.$transaction([
      prisma.reviewFinding.deleteMany({ where: { reportId: report.id } }),
      prisma.reviewFinding.createMany({
        data: findings.map((finding) => ({
          reportId: report.id,
          applicationId,
          ...finding
        }))
      }),
      prisma.aIReviewReport.update({
        where: { id: report.id },
        data: {
          status: "completed",
          overallRiskLevel: recommendation.risk,
          recommendation: recommendation.recommendation,
          summary,
          strengthsJson: json(strengths),
          concernsJson: json(concerns),
          discrepancyJson: json(findings.filter((finding) => finding.category === "document_consistency" || finding.category === "employment_history")),
          pediatricExperienceJson: json(pediatric),
          licenseReviewJson: json(license),
          employmentReviewJson: json(employment),
          documentReviewJson: json(documents),
          hrActionItemsJson: json(recommendation.actionItems),
          generatedAt: new Date()
        }
      })
    ]);

    await logAction(reviewerId, "ai_review_completed", "application", applicationId, { reportId: report.id, risk: recommendation.risk, recommendation: recommendation.recommendation });
    const hasBlockingFindings = findings.some((finding) => finding.severity === "critical" || finding.severity === "concern");
    await transitionApplication({
      applicationId,
      userId: reviewerId,
      status: hasBlockingFindings ? "ai_issues_found" : "ready_for_verification",
      action: hasBlockingFindings ? "ai_issues_found" : "ai_analysis_passed",
      note: hasBlockingFindings
        ? "System-assisted review found compliance issues requiring applicant correction or HR resolution before verification."
        : "System-assisted review found no unresolved compliance issues. Application is ready for verification.",
      taskTitle: hasBlockingFindings ? "Resolve analysis findings" : "Begin final verification",
      taskDescription: hasBlockingFindings ? concerns.join("; ") || "Review findings and resolve issues." : "Open final verification and complete checklist controls.",
      taskPriority: hasBlockingFindings ? "high" : "normal"
    });
    return prisma.aIReviewReport.findUnique({ where: { id: report.id }, include: { findings: true } });
  } catch (error) {
    await prisma.aIReviewReport.update({
      where: { id: report.id },
      data: { status: "failed", summary: "Review generation failed. Please try again or contact an administrator." }
    });
    await logAction(reviewerId, "ai_review_failed", "application", applicationId, { reportId: report.id });
    throw error;
  }
}
