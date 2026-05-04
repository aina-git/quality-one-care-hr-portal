import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { createSystemAlert } from "@/services/alerts/systemAlertService";
import { createApplicantMessageWithEmail } from "@/services/notifications/emailService";
import { renderMessageTemplate } from "@/services/notifications/messageTemplateService";

const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function generateLicenseAlerts(userId?: string | null) {
  const now = new Date();
  const soon = new Date(now.getTime() + thirtyDaysMs);
  const soonSeven = new Date(now.getTime() + sevenDaysMs);
  const licenses = await prisma.license.findMany({
    where: {
      applicationId: { not: null },
      expiresAt: { not: null },
      application: { status: { not: "draft" } }
    },
    include: { application: true }
  });

  const createdAlerts = [];
  for (const license of licenses) {
    if (!license.applicationId || !license.expiresAt) continue;
    const alertType =
      license.expiresAt < now
        ? "expired"
        : license.expiresAt <= soonSeven
          ? "expiring_7_days"
          : license.expiresAt <= soon
            ? "expiring_30_days"
            : null;
    if (!alertType) continue;

    const existing = await prisma.licenseAlert.findUnique({
      where: { licenseId_alertType: { licenseId: license.id, alertType } }
    });
    if (existing) continue;

    const priority = alertType === "expired" ? "critical" : alertType === "expiring_7_days" ? "high" : "normal";
    const templateKey = alertType === "expired" ? "license_expired" : alertType === "expiring_7_days" ? "license_expiring_7_days" : "license_expiring_soon";
    const template = await renderMessageTemplate(templateKey, {
      licenseType: license.type,
      licenseNumber: license.licenseNumber ?? "on file",
      expirationDate: dateOnly(license.expiresAt)
    });
    const alert = await prisma.licenseAlert.create({
      data: {
        applicationId: license.applicationId,
        licenseId: license.id,
        alertType,
        priority,
        message: template.body,
        lastNotifiedAt: new Date()
      }
    });
    await createApplicantMessageWithEmail({
      applicationId: license.applicationId,
      senderRole: "system",
      templateKey: template.templateKey,
      subject: template.subject,
      body: template.body,
      userIdForAudit: userId ?? null
    });
    await createSystemAlert({
      category: "license_expiration",
      priority,
      title: alertType === "expired" ? "License expired" : alertType === "expiring_7_days" ? "License expiring within 7 days" : "License expiring within 30 days",
      message: template.body,
      route: `/hr/applications/${license.applicationId}/review`,
      applicationId: license.applicationId,
      targetRole: "hr",
      dedupeKey: `license:${license.id}:${alertType}`,
      userIdForAudit: userId ?? null
    });
    await logAction(userId ?? null, "license_alert_generated", "license", license.id, {
      applicationId: license.applicationId,
      alertType,
      priority
    });
    createdAlerts.push(alert);
  }

  return createdAlerts;
}
