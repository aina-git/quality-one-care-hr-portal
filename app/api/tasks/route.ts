import type { TaskCategory, TaskPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sanitizeText } from "@/lib/security";
import { createTask } from "@/services/operations/taskService";

const categories = ["application_review", "verification", "onboarding", "training", "license_followup", "document_request", "interview", "general"];
const priorities = ["low", "normal", "high", "urgent"];

export async function POST(request: Request) {
  const user = await requireAuth();
  if (user.role === "executive_view_only" || user.role === "don_approver") {
    return NextResponse.json({ error: "This role has read-only task access." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const category = sanitizeText(body.category, 80) || "general";
  const priority = sanitizeText(body.priority, 80) || "normal";
  const dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;
  if (!sanitizeText(body.title, 200)) return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  if (!categories.includes(category) || !priorities.includes(priority)) {
    return NextResponse.json({ error: "Choose valid task options." }, { status: 400 });
  }
  const task = await createTask({
    title: sanitizeText(body.title, 200),
    description: sanitizeText(body.description, 2000),
    category: category as TaskCategory,
    priority: priority as TaskPriority,
    dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
    assignedToUserId: sanitizeText(body.assignedToUserId, 100) || (user.role === "applicant" ? user.id : null),
    createdByUserId: user.id,
    relatedApplicationId: sanitizeText(body.relatedApplicationId, 100) || null,
    relatedApplicantUserId: sanitizeText(body.relatedApplicantUserId, 100) || null
  });
  return NextResponse.json({ task });
}
