import type { AlertPriority, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { queueOrSendEmail } from "@/services/notifications/emailService";

function buildDedupeKey(input: {
  category: string;
  applicationId?: string | null;
  targetRole?: Role | null;
  dedupeKey?: string | null;
}) {
  if (input.dedupeKey) return input.dedupeKey;
  return [input.category, input.applicationId ?? "none", input.targetRole ?? "all"].join(":");
}

export async function createSystemAlert({
  category,
  priority,
  title,
  message,
  route,
  applicationId,
  targetRole,
  dedupeKey,
  userIdForAudit
}: {
  category: string;
  priority: AlertPriority;
  title: string;
  message: string;
  route?: string | null;
  applicationId?: string | null;
  targetRole?: Role | null;
  dedupeKey?: string | null;
  userIdForAudit?: string | null;
}) {
  const resolvedDedupeKey = buildDedupeKey({ category, applicationId, targetRole, dedupeKey });
  const existing = await prisma.systemAlert.findUnique({ where: { dedupeKey: resolvedDedupeKey } });
  if (existing && !existing.resolved) return existing;

  const alert = existing
    ? await prisma.systemAlert.update({
        where: { id: existing.id },
        data: {
          priority,
          title,
          message,
          route: route ?? null,
          targetRole: targetRole ?? null,
          applicationId: applicationId ?? null,
          resolved: false,
          lastNotifiedAt: new Date()
        }
      })
    : await prisma.systemAlert.create({
        data: {
          category,
          priority,
          title,
          message,
          route: route ?? null,
          applicationId: applicationId ?? null,
          targetRole: targetRole ?? null,
          dedupeKey: resolvedDedupeKey,
          lastNotifiedAt: new Date()
        }
      });

  await logAction(userIdForAudit ?? null, "system_alert_created", "system_alert", alert.id, {
    category,
    priority,
    targetRole,
    applicationId
  });

  return alert;
}

export async function resolveSystemAlert(dedupeKey: string, userIdForAudit?: string | null) {
  const existing = await prisma.systemAlert.findUnique({ where: { dedupeKey } });
  if (!existing || existing.resolved) return existing;

  const updated = await prisma.systemAlert.update({
    where: { id: existing.id },
    data: { resolved: true }
  });
  await logAction(userIdForAudit ?? null, "system_alert_resolved", "system_alert", updated.id, {
    dedupeKey
  });
  return updated;
}

export async function resolveApplicationAlertsByCategory(category: string, applicationId: string, userIdForAudit?: string | null) {
  const alerts = await prisma.systemAlert.findMany({
    where: {
      category,
      applicationId,
      resolved: false
    }
  });
  if (!alerts.length) return 0;

  await prisma.systemAlert.updateMany({
    where: {
      category,
      applicationId,
      resolved: false
    },
    data: { resolved: true }
  });
  await logAction(userIdForAudit ?? null, "system_alerts_resolved", "application", applicationId, {
    category,
    count: alerts.length
  });
  return alerts.length;
}

export async function notifyRoleByEmail({
  role,
  subject,
  body,
  applicationId,
  userIdForAudit
}: {
  role: Role;
  subject: string;
  body: string;
  applicationId?: string | null;
  userIdForAudit?: string | null;
}) {
  const users = await prisma.user.findMany({
    where: { role },
    select: { id: true, email: true }
  });

  for (const user of users) {
    await queueOrSendEmail({
      toEmail: user.email,
      subject,
      body,
      applicationId: applicationId ?? undefined,
      userId: userIdForAudit ?? null
    });
  }
}

export async function getRoleAlerts(role: Role) {
  return prisma.systemAlert.findMany({
    where: {
      resolved: false,
      OR: [{ targetRole: null }, { targetRole: role }]
    },
    include: {
      application: {
        include: {
          applicantProfile: {
            include: {
              user: true
            }
          }
        }
      }
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 8
  });
}
