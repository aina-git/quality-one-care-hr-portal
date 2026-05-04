import type { ReminderType, TaskPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sanitizeText } from "@/lib/security";
import { createReminder } from "@/services/operations/reminderService";

const types = ["task_due", "interview", "training", "license_expiry", "document_missing", "follow_up", "general"];
const priorities = ["low", "normal", "high", "urgent"];

export async function POST(request: Request) {
  const user = await requireAuth();
  const body = await request.json().catch(() => ({}));
  const reminderType = sanitizeText(body.reminderType, 80) || "general";
  const priority = sanitizeText(body.priority, 80) || "normal";
  const triggerDateTime = new Date(String(body.triggerDateTime ?? ""));
  if (!sanitizeText(body.title, 200) || !sanitizeText(body.message, 1000) || Number.isNaN(triggerDateTime.getTime())) {
    return NextResponse.json({ error: "Title, message, and trigger date are required." }, { status: 400 });
  }
  if (!types.includes(reminderType) || !priorities.includes(priority)) {
    return NextResponse.json({ error: "Choose valid reminder options." }, { status: 400 });
  }
  const reminder = await createReminder({
    title: sanitizeText(body.title, 200),
    message: sanitizeText(body.message, 1000),
    reminderType: reminderType as ReminderType,
    triggerDateTime,
    priority: priority as TaskPriority,
    userId: user.id,
    relatedTaskId: sanitizeText(body.relatedTaskId, 100) || null,
    relatedCalendarEventId: sanitizeText(body.relatedCalendarEventId, 100) || null,
    relatedApplicationId: sanitizeText(body.relatedApplicationId, 100) || null
  });
  return NextResponse.json({ reminder });
}
