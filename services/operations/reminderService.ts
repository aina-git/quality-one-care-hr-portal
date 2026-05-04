import type { ReminderType, TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { createNotification } from "@/services/operations/notificationService";

export async function createReminder({
  title,
  message,
  reminderType = "general",
  triggerDateTime,
  priority = "normal",
  userId,
  relatedTaskId,
  relatedCalendarEventId,
  relatedApplicationId,
  deliveryChannels = ["in_app"]
}: {
  title: string;
  message: string;
  reminderType?: ReminderType;
  triggerDateTime: Date;
  priority?: TaskPriority;
  userId: string;
  relatedTaskId?: string | null;
  relatedCalendarEventId?: string | null;
  relatedApplicationId?: string | null;
  deliveryChannels?: string[];
}) {
  const reminder = await prisma.reminder.create({
    data: {
      title: sanitizeText(title, 200),
      message: sanitizeText(message, 1000),
      reminderType,
      triggerDateTime,
      priority,
      userId,
      relatedTaskId: relatedTaskId ?? null,
      relatedCalendarEventId: relatedCalendarEventId ?? null,
      relatedApplicationId: relatedApplicationId ?? null,
      deliveryChannels
    }
  });
  await logAction(userId, "reminder_created", "reminder", reminder.id, { reminderType, priority });
  return reminder;
}

export async function dismissReminder(reminderId: string, userId: string) {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder || reminder.userId !== userId) throw new Error("Reminder not found.");
  const updated = await prisma.reminder.update({ where: { id: reminderId }, data: { status: "dismissed" } });
  await logAction(userId, "reminder_dismissed", "reminder", reminderId);
  return updated;
}

export async function triggerDueReminders(now = new Date()) {
  const reminders = await prisma.reminder.findMany({
    where: { status: { in: ["scheduled", "snoozed"] }, triggerDateTime: { lte: now } },
    take: 50
  });
  for (const reminder of reminders) {
    await prisma.reminder.update({ where: { id: reminder.id }, data: { status: "triggered" } });
    await createNotification({
      userId: reminder.userId,
      applicationId: reminder.relatedApplicationId,
      notificationType: "reminder",
      priority: reminder.priority,
      title: reminder.title,
      body: reminder.message,
      route: "/notifications",
      relatedReminderId: reminder.id
    });
    await logAction(reminder.userId, "reminder_triggered", "reminder", reminder.id);
  }
  return reminders.length;
}
