import type {
  DonDecision,
  ExternalVerificationType,
  Prisma,
  VerificationCategory,
  VerificationItemStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { getVerificationLink } from "@/services/verification/verificationLinks";
import { ensureEmployeeOnboarding } from "@/services/onboarding/employeeOnboardingService";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";
import { sendCommunication } from "@/services/communications/communicationService";

export const defaultVerificationItems: Array<{
  category: VerificationCategory;
  title: string;
  requirement: string;
}> = [
  {
    category: "employment_history",
    title: "Employment History",
    requirement: "Applicant must have at least 1 year of clinical experience involving pediatric patients within the past 2 years."
  },
  {
    category: "professional_employment_verification",
    title: "2 Professional Employment Verifications",
    requirement: "At least 2 professional employment verifications must be completed and recorded."
  },
  {
    category: "character_reference",
    title: "Character Reference",
    requirement: "At least 1 character reference must be completed and recorded."
  },
  {
    category: "background_check_cgis",
    title: "Background Check CGIS",
    requirement: "CGIS/background check receipt must be uploaded or recorded for Quality One Care Home Health Inc., MA Provider Number 420641000."
  },
  {
    category: "oig_exclusion",
    title: "OIG Exclusion List",
    requirement: "OIG exclusion check must be completed and result recorded."
  },
  {
    category: "maryland_case_search",
    title: "Maryland Case Search",
    requirement: "Maryland Case Search must be completed and result recorded."
  },
  {
    category: "nursys",
    title: "Nursys",
    requirement: "Nursys verification must be completed for RN/LPN applicants."
  },
  {
    category: "maryland_board_of_nursing",
    title: "Current and Active Nursing License",
    requirement: "Maryland Board of Nursing license must be current and active for RN/LPN applicants."
  },
  {
    category: "annual_physical_health",
    title: "Annual Physical Health Form",
    requirement: "Annual physical form must be uploaded or recorded."
  },
  {
    category: "tb_test_or_chest_xray",
    title: "TB Test or Chest X-ray",
    requirement: "Current TB test or chest X-ray must be uploaded or recorded."
  },
  {
    category: "liability_insurance_nso",
    title: "NSO Liability Insurance",
    requirement: "Liability insurance must be current where applicable."
  },
  {
    category: "cpr",
    title: "Current and Active CPR",
    requirement: "CPR certification must be current and active."
  },
  {
    category: "id_or_work_authorization",
    title: "Current ID or Work Authorization",
    requirement: "Applicant must have current and non-expired state ID, driver's license, green card, work authorization, or American passport."
  },
  {
    category: "sanitation_training",
    title: "Sanitation Training",
    requirement: "Sanitation training must be completed where required."
  },
  {
    category: "final_decision",
    title: "Final DON Decision",
    requirement: "Final hiring approval must be reviewed and submitted by authorized DON/Admin personnel."
  }
];

const optionalByDefault: VerificationCategory[] = [
  "nursys",
  "maryland_board_of_nursing",
  "liability_insurance_nso",
  "sanitation_training",
  "final_decision"
];

const criticalCategories: VerificationCategory[] = [
  "employment_history",
  "background_check_cgis",
  "oig_exclusion",
  "maryland_case_search",
  "nursys",
  "maryland_board_of_nursing",
  "cpr",
  "id_or_work_authorization"
];

export function isNursingRole(value: string | null | undefined) {
  return /\b(rn|lpn|nurse|nursing|skilled)\b/i.test(value ?? "");
}

export function itemRequiresCompletion(category: VerificationCategory, desiredRole?: string | null) {
  if ((category === "nursys" || category === "maryland_board_of_nursing") && !isNursingRole(desiredRole)) return false;
  if (category === "final_decision") return false;
  return !optionalByDefault.includes(category);
}

function isSatisfied(status: VerificationItemStatus, notes?: string | null) {
  if (status === "verified") return true;
  return status === "not_applicable" && Boolean(notes?.trim());
}

function isBlockingStatus(status: VerificationItemStatus) {
  return status === "failed" || status === "expired";
}

function dateIsExpired(value?: Date | null) {
  if (!value) return false;
  return value.getTime() < Date.now();
}

export function summarizeChecklist(checklist: {
  application: { desiredRole: string | null };
  items: Array<{
    id: string;
    category: VerificationCategory;
    status: VerificationItemStatus;
    expirationDate: Date | null;
    notes: string | null;
    title: string;
    result: string | null;
  }>;
}) {
  const requiredItems = checklist.items.filter((item) => itemRequiresCompletion(item.category, checklist.application.desiredRole));
  const satisfied = requiredItems.filter((item) => isSatisfied(item.status, item.notes));
  const expiredItems = checklist.items.filter((item) => item.status === "expired" || dateIsExpired(item.expirationDate));
  const failedItems = checklist.items.filter((item) => item.status === "failed");
  const missingItems = requiredItems.filter((item) => !isSatisfied(item.status, item.notes));
  const criticalBlockers = checklist.items.filter((item) => {
    if (!criticalCategories.includes(item.category)) return false;
    if (isBlockingStatus(item.status) || dateIsExpired(item.expirationDate)) return true;
    if (itemRequiresCompletion(item.category, checklist.application.desiredRole) && !isSatisfied(item.status, item.notes)) return true;
    if ((item.category === "oig_exclusion" || item.category === "maryland_case_search") && /fail|hit|match|concern/i.test(item.result ?? "")) return true;
    return false;
  });
  const warnings = checklist.items.filter((item) => {
    if (criticalBlockers.includes(item)) return false;
    if (item.status === "needs_followup" || item.status === "pending_external_check") return true;
    if (item.category === "liability_insurance_nso" && !isSatisfied(item.status, item.notes)) return true;
    return false;
  });
  const completionPercentage = requiredItems.length ? Math.round((satisfied.length / requiredItems.length) * 100) : 100;
  const readyForDon = criticalBlockers.length === 0 && missingItems.length === 0 && warnings.every((item) => Boolean(item.notes?.trim()));

  return {
    requiredCount: requiredItems.length,
    completedRequiredCount: satisfied.length,
    completionPercentage,
    missingItems,
    expiredItems,
    failedItems,
    criticalBlockers,
    warnings,
    readyForDon
  };
}

export async function ensureFinalVerificationChecklist(applicationId: string, userId?: string | null) {
  const existing = await prisma.finalVerificationChecklist.findUnique({
    where: { applicationId },
    include: { items: true, application: true }
  });
  if (existing) return existing;

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error("Application not found.");
  const allowedStatuses = ["approved", "hr_review_started", "under_review", "ready_for_verification", "verification_in_progress", "verification_passed"];
  if (!allowedStatuses.includes(application.status)) {
    throw new Error("Final verification starts after HR screening is complete.");
  }

  const checklist = await prisma.finalVerificationChecklist.create({
    data: {
      applicationId,
      status: "in_progress",
      preparedByUserId: userId ?? null,
      items: {
        create: defaultVerificationItems.map((item) => {
          const link = getVerificationLink(item.category);
          return {
            ...item,
            status: itemRequiresCompletion(item.category, application.desiredRole) ? "pending" : "not_applicable",
            source: link?.providerName ?? null,
            notes: itemRequiresCompletion(item.category, application.desiredRole) ? null : "Not applicable based on current role or workflow."
          };
        })
      }
    },
    include: { items: true, application: true }
  });

  await logAction(userId ?? null, "final_verification_created", "application", applicationId, {
    checklistId: checklist.id
  });
  await updateApplicationLifecycle({
    applicationId,
    userId,
    action: "verification_started",
    patch: { status: "verification_in_progress", verificationStartedAt: new Date() },
    details: { checklistId: checklist.id }
  });
  return checklist;
}

export async function getVerificationChecklist(applicationId: string) {
  return prisma.finalVerificationChecklist.findUnique({
    where: { applicationId },
    include: {
      application: {
        include: {
          applicantProfile: { include: { user: true } },
          documents: true,
          licenses: true,
          aiReviewReports: { orderBy: { createdAt: "desc" }, take: 1 },
          decisions: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      },
      preparedByUser: true,
      reviewedByUser: true,
      approvedByUser: true,
      items: {
        include: { verifiedByUser: true, document: true, externalRecords: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

export async function updateVerificationItem({
  itemId,
  userId,
  status,
  result,
  expirationDate,
  externalReferenceNumber,
  notes,
  documentId
}: {
  itemId: string;
  userId: string;
  status?: VerificationItemStatus;
  result?: string;
  expirationDate?: Date | null;
  externalReferenceNumber?: string;
  notes?: string;
  documentId?: string | null;
}) {
  const item = await prisma.verificationChecklistItem.findUnique({
    where: { id: itemId },
    include: { checklist: { include: { application: true } } }
  });
  if (!item) throw new Error("Verification item not found.");
  if (status === "not_applicable" && !sanitizeText(notes, 2000)) {
    throw new Error("A note is required when marking an item not applicable.");
  }

  const nextExpiration = expirationDate === undefined ? item.expirationDate : expirationDate;
  // HR's explicit decision wins. Previously this auto-flipped status from "verified"
  // to "expired" when the expiration date was in the past, which made HR's manual
  // verification appear to silently fail. If the date is stale, surface that as a
  // warning in the UI — don't override the reviewer's call.
  const nextStatus = status;
  const updated = await prisma.verificationChecklistItem.update({
    where: { id: itemId },
    data: {
      status: nextStatus,
      result: result === undefined ? undefined : sanitizeText(result, 2000),
      expirationDate: nextExpiration,
      externalReferenceNumber: externalReferenceNumber === undefined ? undefined : sanitizeText(externalReferenceNumber, 200),
      notes: notes === undefined ? undefined : sanitizeText(notes, 4000),
      documentId: documentId === undefined ? undefined : documentId,
      verifiedByUserId: nextStatus ? userId : undefined,
      verifiedAt: nextStatus ? new Date() : undefined
    },
    include: { checklist: { include: { application: true } } }
  });

  await refreshChecklistStatus(updated.checklistId, userId);
  await logAction(userId, "verification_item_updated", "verification_item", itemId, {
    applicationId: item.checklist.applicationId,
    category: item.category,
    oldValue: {
      status: item.status,
      result: item.result,
      expirationDate: item.expirationDate,
      externalReferenceNumber: item.externalReferenceNumber,
      documentId: item.documentId,
      notes: item.notes
    },
    newValue: {
      status: updated.status,
      result: updated.result,
      expirationDate: updated.expirationDate,
      externalReferenceNumber: updated.externalReferenceNumber,
      documentId: updated.documentId,
      notes: updated.notes
    }
  });
  if (documentId !== undefined && documentId && documentId !== item.documentId) {
    await logAction(userId, "verification_document_attached", "verification_item", itemId, {
      applicationId: item.checklist.applicationId,
      documentId
    });
  }
  return updated;
}

export async function attachVerificationDocument(itemId: string, documentId: string, userId: string) {
  const item = await prisma.verificationChecklistItem.findUnique({
    where: { id: itemId },
    include: { checklist: true }
  });
  if (!item) throw new Error("Verification item not found.");
  const document = await prisma.uploadedDocument.findUnique({ where: { id: documentId } });
  if (!document || document.applicationId !== item.checklist.applicationId) {
    throw new Error("Evidence document was not found for this application.");
  }

  const updated = await prisma.verificationChecklistItem.update({
    where: { id: itemId },
    data: { documentId }
  });
  await logAction(userId, "verification_document_attached", "verification_item", itemId, {
    applicationId: item.checklist.applicationId,
    documentId
  });
  return updated;
}

export async function recordExternalVerification({
  itemId,
  userId,
  verificationType,
  providerName,
  searchUrl,
  searchDate,
  applicantNameUsed,
  licenseNumberUsed,
  trackingNumber,
  result,
  notes,
  evidenceDocumentId
}: {
  itemId: string;
  userId: string;
  verificationType: ExternalVerificationType;
  providerName: string;
  searchUrl?: string;
  searchDate?: Date | null;
  applicantNameUsed?: string;
  licenseNumberUsed?: string;
  trackingNumber?: string;
  result?: string;
  notes?: string;
  evidenceDocumentId?: string | null;
}) {
  const item = await prisma.verificationChecklistItem.findUnique({
    where: { id: itemId },
    include: { checklist: true }
  });
  if (!item) throw new Error("Verification item not found.");

  const record = await prisma.externalVerificationRecord.create({
    data: {
      applicationId: item.checklist.applicationId,
      checklistItemId: itemId,
      verificationType,
      providerName: sanitizeText(providerName, 200),
      searchUrl: sanitizeText(searchUrl, 1000) || null,
      searchDate,
      searchedByUserId: userId,
      applicantNameUsed: sanitizeText(applicantNameUsed, 200) || null,
      licenseNumberUsed: sanitizeText(licenseNumberUsed, 100) || null,
      trackingNumber: sanitizeText(trackingNumber, 120) || null,
      result: sanitizeText(result, 2000) || null,
      notes: sanitizeText(notes, 4000) || null,
      evidenceDocumentId: evidenceDocumentId || null
    }
  });

  await logAction(userId, "external_verification_recorded", "external_verification", record.id, {
    applicationId: item.checklist.applicationId,
    checklistItemId: itemId,
    verificationType
  });
  return record;
}

export async function refreshChecklistStatus(checklistId: string, userId?: string | null) {
  const checklist = await prisma.finalVerificationChecklist.findUnique({
    where: { id: checklistId },
    include: { application: true, items: true }
  });
  if (!checklist) throw new Error("Verification checklist not found.");
  if (checklist.status === "approved_by_don" || checklist.status === "rejected_by_don") return checklist;

  const summary = summarizeChecklist(checklist);
  const status = summary.readyForDon ? "ready_for_don_review" : "in_progress";
  const updated = await prisma.finalVerificationChecklist.update({
    where: { id: checklistId },
    data: {
      status,
      reviewedByUserId: summary.readyForDon ? userId ?? undefined : undefined,
      submittedToDonAt: summary.readyForDon && !checklist.submittedToDonAt ? new Date() : undefined
    },
    include: { application: true, items: true }
  });

  if (summary.readyForDon && checklist.status !== "ready_for_don_review") {
    await updateApplicationLifecycle({
      applicationId: checklist.applicationId,
      userId,
      action: "verification_completed",
      patch: {
        status: "ready_for_don_review",
        verificationCompletedAt: new Date(),
        submittedToDonAt: updated.submittedToDonAt ?? new Date()
      },
      details: { checklistId }
    });
    await logAction(userId ?? null, "checklist_ready_for_don", "final_verification", checklistId, {
      applicationId: checklist.applicationId,
      completionPercentage: summary.completionPercentage
    });
  }
  return updated;
}

export async function submitDonDecision({
  applicationId,
  userId,
  decision,
  comment
}: {
  applicationId: string;
  userId: string;
  decision: DonDecision;
  comment: string;
}) {
  const checklist = await getVerificationChecklist(applicationId);
  if (!checklist) throw new Error("Final verification checklist not found.");
  const summary = summarizeChecklist(checklist);
  const cleanComment = sanitizeText(comment, 4000);

  if (decision === "approved_for_hire" && !summary.readyForDon) {
    throw new Error("DON approval is blocked until all required verification items are complete.");
  }
  if ((decision === "not_approved" || decision === "returned_for_correction") && !cleanComment) {
    throw new Error("DON comments are required for this decision.");
  }

  const now = new Date();
  const status = decision === "approved_for_hire" ? "approved_by_don" : decision === "not_approved" ? "rejected_by_don" : "returned_for_correction";
  const updated = await prisma.finalVerificationChecklist.update({
    where: { applicationId },
    data: {
      status,
      donDecision: decision,
      donComment: cleanComment,
      approvedByUserId: userId,
      approvedAt: decision === "approved_for_hire" ? now : null,
      rejectedAt: decision === "not_approved" ? now : null
    }
  });

  if (decision === "not_approved") {
    await updateApplicationLifecycle({
      applicationId,
      userId,
      action: "don_decision_not_approved",
      patch: { status: "don_rejected", donDecisionAt: now, rejectedAt: now }
    });
    await sendCommunication({
      applicationId,
      senderId: userId,
      senderRole: "admin",
      channel: "email",
      subject: "Quality One Care application update",
      body: "Final outcome: Not Suitable. Please review your applicant portal for details.",
      visibleToApplicant: true
    }).catch(() => null);
  }
  if (decision === "approved_for_hire") {
    await ensureEmployeeOnboarding(applicationId, userId);
    await updateApplicationLifecycle({
      applicationId,
      userId,
      action: "don_decision_approved",
      patch: { status: "don_approved", donDecisionAt: now, hiredAt: now, onboardingStartedAt: now }
    });
    await sendCommunication({
      applicationId,
      senderId: userId,
      senderRole: "admin",
      channel: "email",
      subject: "Quality One Care application update",
      body: "Final outcome: About to be Hired. Please review your applicant portal for onboarding details.",
      visibleToApplicant: true
    }).catch(() => null);
  }
  if (decision === "returned_for_correction") {
    await updateApplicationLifecycle({
      applicationId,
      userId,
      action: "don_decision_returned",
      patch: { status: "more_information_required", donDecisionAt: now }
    });
    await sendCommunication({
      applicationId,
      senderId: userId,
      senderRole: "admin",
      channel: "email",
      subject: "More information required",
      body: cleanComment || "Final review requires more information. Please review your applicant portal.",
      visibleToApplicant: true
    }).catch(() => null);
    await logAction(userId, "checklist_returned_for_correction", "final_verification", updated.id, { applicationId });
  }

  await logAction(userId, "don_decision_submitted", "final_verification", updated.id, {
    applicationId,
    decision
  });
  return updated;
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
