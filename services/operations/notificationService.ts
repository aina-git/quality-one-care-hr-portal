import type { NotificationType, TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";

const IDEMPOTENCY_WINDOW_MS = 60 * 60 * 1000; // 60 minutes

export async function createNotification({
  userId,
  applicationId,
  notificationType,
  priority = "normal",
  title,
  body,
  route,
  relatedTaskId,
  relatedCalendarEventId,
  relatedReminderId
}: {
  userId: string;
  applicationId?: string | null;
  notificationType: NotificationType;
  priority?: TaskPriority;
  title: string;
  body: string;
  route?: string | null;
  relatedTaskId?: string | null;
  relatedCalendarEventId?: string | null;
  relatedReminderId?: string | null;
}) {
  const cleanTitle = sanitizeText(title, 200);
  const cleanBody = sanitizeText(body, 1000);

  // Idempotency: if an identical UNREAD notification already exists for this
  // user within the last hour, just refresh its timestamp instead of creating
  // a duplicate row. Prevents the "29 of the same alert" inflation.
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      applicationId: applicationId ?? null,
      notificationType,
      title: cleanTitle,
      readAt: null,
      createdAt: { gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) }
    },
    orderBy: { createdAt: "desc" }
  });

  if (existing) {
    return prisma.notification.update({
      where: { id: existing.id },
      data: {
        body: cleanBody,
        priority,
        route: route ?? null,
        relatedTaskId: relatedTaskId ?? null,
        relatedCalendarEventId: relatedCalendarEventId ?? null,
        relatedReminderId: relatedReminderId ?? null
      }
    });
  }

  return prisma.notification.create({
    data: {
      userId,
      applicationId: applicationId ?? null,
      notificationType,
      priority,
      title: cleanTitle,
      body: cleanBody,
      route: route ?? null,
      relatedTaskId: relatedTaskId ?? null,
      relatedCalendarEventId: relatedCalendarEventId ?? null,
      relatedReminderId: relatedReminderId ?? null
    }
  });
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.userId !== userId) throw new Error("Notification not found.");
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() }
  });
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() }
  });
  await logAction(userId, "notifications_marked_read", "notification", null, { count: result.count });
  return result;
}

/**
 * Count of UNIQUE unread notifications for a user. Two notifications with the
 * same (notificationType, applicationId, title) collapse into one — fixes the
 * "29 of the same alert" badge inflation when older rows haven't been deduped
 * via the idempotency check yet (e.g. created before this fix shipped).
 */
export async function countUniqueUnreadNotifications(userId: string): Promise<number> {
  const groups = await prisma.notification.groupBy({
    by: ["notificationType", "applicationId", "title"],
    where: { userId, readAt: null },
    _count: { _all: true }
  });
  return groups.length;
}

export type GroupedNotification = {
  representativeId: string;
  notificationType: string;
  applicationId: string | null;
  title: string;
  body: string;
  priority: string;
  route: string | null;
  createdAt: Date;
  latestUnreadCreatedAt: Date | null;
  duplicateCount: number;
  unreadCount: number;
  duplicateIds: string[];
};

/**
 * Returns notifications collapsed by (notificationType, applicationId, title).
 * Each group is represented by its most recent row. Read state for the group
 * is "all read" only when every row is read.
 */
export async function listGroupedNotifications(
  userId: string,
  opts: { take?: number } = {}
): Promise<GroupedNotification[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });

  const map = new Map<string, GroupedNotification>();
  for (const row of rows) {
    const key = [row.notificationType, row.applicationId ?? "", row.title].join("|");
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        representativeId: row.id,
        notificationType: row.notificationType,
        applicationId: row.applicationId,
        title: row.title,
        body: row.body,
        priority: row.priority,
        route: row.route,
        createdAt: row.createdAt,
        latestUnreadCreatedAt: row.readAt ? null : row.createdAt,
        duplicateCount: 1,
        unreadCount: row.readAt ? 0 : 1,
        duplicateIds: [row.id]
      });
    } else {
      existing.duplicateCount += 1;
      if (!row.readAt) {
        existing.unreadCount += 1;
        if (!existing.latestUnreadCreatedAt || row.createdAt > existing.latestUnreadCreatedAt) {
          existing.latestUnreadCreatedAt = row.createdAt;
        }
      }
      existing.duplicateIds.push(row.id);
    }
  }

  const grouped = Array.from(map.values()).sort((a, b) => {
    // Unread groups first; within each, latest first.
    if ((a.unreadCount > 0) !== (b.unreadCount > 0)) return a.unreadCount > 0 ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  return opts.take ? grouped.slice(0, opts.take) : grouped;
}
