import type { OnboardingItemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { createApplicantMessageWithEmail } from "@/services/notifications/emailService";
import { renderMessageTemplate } from "@/services/notifications/messageTemplateService";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";

const defaultItems = [
  ["Verify identity documents", "Confirm government ID and employment eligibility documents."],
  ["Complete employee paperwork", "Collect signed HR forms required before the first assignment."],
  ["Confirm clinical credentials", "Verify licenses, certifications, and pediatric care requirements."],
  ["Assign onboarding orientation", "Prepare orientation details for the applicant."]
];

export async function ensureOnboardingChecklist(applicationId: string, userId?: string | null) {
  const existing = await prisma.onboardingChecklist.findUnique({
    where: { applicationId },
    include: { items: { orderBy: { createdAt: "asc" } } }
  });
  if (existing) return existing;

  const checklist = await prisma.onboardingChecklist.create({
    data: {
      applicationId,
      status: "in_progress",
      items: {
        create: defaultItems.map(([title, description]) => ({ title, description }))
      }
    },
    include: { items: { orderBy: { createdAt: "asc" } } }
  });

  const template = await renderMessageTemplate("onboarding_created", {});
  await createApplicantMessageWithEmail({
    applicationId,
    senderId: userId ?? null,
    senderRole: "system",
    templateKey: template.templateKey,
    subject: template.subject,
    body: template.body,
    userIdForAudit: userId ?? null
  });
  await logAction(userId ?? null, "onboarding_checklist_created", "application", applicationId);
  await updateApplicationLifecycle({
    applicationId,
    userId,
    action: "onboarding_started",
    patch: { onboardingStartedAt: new Date() },
    details: { checklistId: checklist.id }
  });

  return checklist;
}

export async function updateOnboardingItem(itemId: string, status: OnboardingItemStatus, userId: string) {
  const item = await prisma.onboardingItem.findUnique({
    where: { id: itemId },
    include: { checklist: { include: { items: true } } }
  });
  if (!item) throw new Error("Onboarding item not found.");

  const updated = await prisma.onboardingItem.update({
    where: { id: itemId },
    data: {
      status,
      completedAt: status === "completed" ? new Date() : null,
      completedById: status === "completed" ? userId : null
    }
  });

  const items = await prisma.onboardingItem.findMany({ where: { checklistId: item.checklistId } });
  const complete = items.length > 0 && items.every((entry) => entry.id === itemId ? status !== "pending" : entry.status !== "pending");
  await prisma.onboardingChecklist.update({
    where: { id: item.checklistId },
    data: {
      status: complete ? "completed" : "in_progress",
      completedAt: complete ? new Date() : null
    }
  });

  await logAction(userId, "onboarding_item_updated", "onboarding_item", itemId, { status });
  return updated;
}
