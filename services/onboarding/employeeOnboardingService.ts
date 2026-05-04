import type { OnboardingTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { generateTrainingRecommendations } from "@/services/training/trainingRecommendationService";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";

const defaultEmployeeTasks = [
  ["Review Employee Manual", "Review Quality One Care employment policies and handbook expectations."],
  ["Complete Compliance Training", "Complete required compliance orientation before assignment."],
  ["Complete Pediatric Care Training", "Complete pediatric care readiness training for home health services."],
  ["Complete KanTime Training", "Complete KanTime system onboarding and documentation workflow training."],
  ["Submit required onboarding documents", "Submit any remaining HR and clinical onboarding documents."]
];

export async function ensureEmployeeOnboarding(applicationId: string, userId?: string | null) {
  const existing = await prisma.employeeOnboarding.findUnique({
    where: { applicationId },
    include: { tasks: { orderBy: { createdAt: "asc" } } }
  });
  if (existing) return existing;

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error("Application not found.");

  const onboarding = await prisma.employeeOnboarding.create({
    data: {
      applicationId,
      status: "in_progress",
      tasks: {
        create: defaultEmployeeTasks.map(([title, description], index) => ({
          title,
          description,
          dueDate: new Date(Date.now() + (index + 7) * 24 * 60 * 60 * 1000)
        }))
      }
    },
    include: { tasks: { orderBy: { createdAt: "asc" } } }
  });

  await generateTrainingRecommendations(applicationId, userId ?? null);
  await updateApplicationLifecycle({
    applicationId,
    userId,
    action: "onboarding_started",
    patch: { onboardingStartedAt: new Date() },
    details: { onboardingId: onboarding.id }
  });
  await logAction(userId ?? null, "onboarding_created", "application", applicationId, {
    onboardingId: onboarding.id
  });
  return onboarding;
}

export async function updateEmployeeOnboardingTask({
  taskId,
  userId,
  status,
  assignedToId,
  dueDate,
  title,
  description
}: {
  taskId: string;
  userId: string;
  status?: OnboardingTaskStatus;
  assignedToId?: string | null;
  dueDate?: Date | null;
  title?: string;
  description?: string;
}) {
  const task = await prisma.onboardingTask.findUnique({
    where: { id: taskId },
    include: { onboarding: { include: { tasks: true } } }
  });
  if (!task) throw new Error("Onboarding task not found.");

  const updated = await prisma.onboardingTask.update({
    where: { id: taskId },
    data: {
      status,
      assignedToId: assignedToId === undefined ? undefined : assignedToId,
      dueDate: dueDate === undefined ? undefined : dueDate,
      title: title === undefined ? undefined : sanitizeText(title, 200),
      description: description === undefined ? undefined : sanitizeText(description, 1000),
      completedAt: status === "completed" ? new Date() : status === "pending" ? null : undefined,
      completedById: status === "completed" ? userId : status === "pending" ? null : undefined
    }
  });

  const tasks = await prisma.onboardingTask.findMany({ where: { onboardingId: task.onboardingId } });
  const complete = tasks.length > 0 && tasks.every((entry) => entry.id === taskId ? status && status !== "pending" : entry.status !== "pending");
  await prisma.employeeOnboarding.update({
    where: { id: task.onboardingId },
    data: {
      status: complete ? "completed" : "in_progress",
      completedDate: complete ? new Date() : null
    }
  });

  if (status === "completed") {
    await logAction(userId, "onboarding_task_completed", "onboarding_task", taskId, {
      onboardingId: task.onboardingId
    });
  } else {
    await logAction(userId, "onboarding_task_updated", "onboarding_task", taskId, {
      onboardingId: task.onboardingId,
      status
    });
  }
  return updated;
}
