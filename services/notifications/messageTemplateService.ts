import { prisma } from "@/lib/prisma";

type TemplateInput = {
  key: string;
  category: string;
  subject: string;
  body: string;
};

const defaultTemplates: TemplateInput[] = [
  {
    key: "clarification_requested",
    category: "application",
    subject: "Clarification requested for your application",
    body: "{{note}}"
  },
  {
    key: "interview_scheduled",
    category: "interview",
    subject: "Interview scheduled",
    body: "Your interview is scheduled for {{scheduledAt}}. Location or format: {{location}}. {{notes}}"
  },
  {
    key: "interview_updated",
    category: "interview",
    subject: "Interview updated",
    body: "Your interview details were updated. Scheduled time: {{scheduledAt}}. Location or format: {{location}}. {{notes}}"
  },
  {
    key: "interview_cancelled",
    category: "interview",
    subject: "Interview cancelled",
    body: "Your interview has been cancelled. {{notes}}"
  },
  {
    key: "onboarding_created",
    category: "onboarding",
    subject: "Onboarding checklist created",
    body: "Your onboarding checklist is ready. Please review your progress from your applicant dashboard."
  },
  {
    key: "license_expired",
    category: "license",
    subject: "License expired",
    body: "{{licenseType}} license {{licenseNumber}} expired on {{expirationDate}}."
  },
  {
    key: "license_expiring_soon",
    category: "license",
    subject: "License expiring soon",
    body: "{{licenseType}} license {{licenseNumber}} expires on {{expirationDate}}."
  },
  {
    key: "license_expiring_7_days",
    category: "license",
    subject: "License expiring within 7 days",
    body: "{{licenseType}} license {{licenseNumber}} expires on {{expirationDate}}. Please update this as soon as possible."
  },
  {
    key: "draft_inactivity_reminder",
    category: "application",
    subject: "Reminder to continue your application",
    body: "Your application is still in draft and has been inactive since {{lastUpdatedAt}}. Please return to complete the next steps."
  },
  {
    key: "correction_inactivity_reminder",
    category: "application",
    subject: "Reminder to respond to your correction request",
    body: "HR requested updates to your application and it has been inactive since {{lastUpdatedAt}}. Please review your messages, make corrections, and resubmit when ready."
  },
  {
    key: "pending_hr_review",
    category: "review",
    subject: "Application pending HR review",
    body: "{{applicantName}} submitted an application on {{submittedAt}} and it is still awaiting review."
  },
  {
    key: "bulk_application_reminder",
    category: "application",
    subject: "Reminder from Quality One Care",
    body: "{{note}}"
  }
];

export function renderTemplateText(template: string, values: Record<string, string | number | null | undefined>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? "").trim());
}

export async function ensureDefaultMessageTemplates() {
  for (const template of defaultTemplates) {
    await prisma.messageTemplate.upsert({
      where: { key: template.key },
      update: {},
      create: template
    });
  }
}

export async function renderMessageTemplate(key: string, values: Record<string, string | number | null | undefined>) {
  await ensureDefaultMessageTemplates();
  const template = await prisma.messageTemplate.findUnique({ where: { key } });
  if (!template || !template.active) throw new Error("Message template is not available.");
  return {
    templateKey: key,
    subject: renderTemplateText(template.subject, values),
    body: renderTemplateText(template.body, values)
  };
}
