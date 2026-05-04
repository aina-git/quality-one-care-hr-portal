import type { TaskCategory, TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { createNotification } from "@/services/operations/notificationService";

export async function createTask({
  title,
  description,
  category = "general",
  priority = "normal",
  dueDate,
  assignedToUserId,
  createdByUserId,
  relatedApplicationId,
  relatedApplicantUserId,
  reminderDateTime
}: {
  title: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  dueDate?: Date | null;
  assignedToUserId?: string | null;
  createdByUserId?: string | null;
  relatedApplicationId?: string | null;
  relatedApplicantUserId?: string | null;
  reminderDateTime?: Date | null;
}) {
  const task = await prisma.task.create({
    data: {
      title: sanitizeText(title, 200),
      description: sanitizeText(description, 2000) || null,
      category,
      priority,
      dueDate: dueDate ?? null,
      assignedToUserId: assignedToUserId ?? null,
      createdByUserId: createdByUserId ?? null,
      relatedApplicationId: relatedApplicationId ?? null,
      relatedApplicantUserId: relatedApplicantUserId ?? null,
      reminderDateTime: reminderDateTime ?? null
    }
  });

  await logAction(createdByUserId ?? null, "task_created", "task", task.id, { category, priority, relatedApplicationId });
  if (assignedToUserId) {
    await createNotification({
      userId: assignedToUserId,
      applicationId: relatedApplicationId ?? null,
      notificationType: "task",
      priority,
      title: `Task assigned: ${task.title}`,
      body: task.description ?? "A task was assigned to you.",
      route: "/tasks",
      relatedTaskId: task.id
    });
  }
  return task;
}

export async function updateTask({
  taskId,
  userId,
  title,
  description,
  category,
  priority,
  status,
  dueDate,
  assignedToUserId,
  reminderDateTime
}: {
  taskId: string;
  userId: string;
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: Date | null;
  assignedToUserId?: string | null;
  reminderDateTime?: Date | null;
}) {
  const current = await prisma.task.findUnique({ where: { id: taskId } });
  if (!current) throw new Error("Task not found.");
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: title === undefined ? undefined : sanitizeText(title, 200),
      description: description === undefined ? undefined : sanitizeText(description, 2000) || null,
      category,
      priority,
      status,
      dueDate: dueDate === undefined ? undefined : dueDate,
      assignedToUserId: assignedToUserId === undefined ? undefined : assignedToUserId,
      reminderDateTime: reminderDateTime === undefined ? undefined : reminderDateTime,
      completedAt: status === undefined ? undefined : status === "completed" ? new Date() : null
    }
  });
  await logAction(userId, status === "completed" ? "task_completed" : "task_updated", "task", taskId, {
    status: updated.status,
    priority: updated.priority
  });
  return updated;
}
