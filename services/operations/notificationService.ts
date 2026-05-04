import type { NotificationType, TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";

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
  return prisma.notification.create({
    data: {
      userId,
      applicationId: applicationId ?? null,
      notificationType,
      priority,
      title: sanitizeText(title, 200),
      body: sanitizeText(body, 1000),
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
