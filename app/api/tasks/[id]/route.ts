import type { TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security";
import { updateTask } from "@/services/operations/taskService";

const statuses = ["open", "in_progress", "completed", "overdue", "cancelled"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (user.role === "executive_view_only" || user.role === "don_approver") {
    return NextResponse.json({ error: "This role has read-only task access." }, { status: 403 });
  }
  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  if (user.role === "applicant" && task.assignedToUserId !== user.id && task.relatedApplicantUserId !== user.id) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const status = body.status === undefined ? undefined : sanitizeText(body.status, 80);
  if (status && !statuses.includes(status)) return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
  const updated = await updateTask({ taskId: id, userId: user.id, status: status as TaskStatus | undefined });
  return NextResponse.json({ task: updated });
}
