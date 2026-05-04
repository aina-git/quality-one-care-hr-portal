import type { InterviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { scheduleOrUpdateInterview, updateInterviewStatus } from "@/services/interview/interviewService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "admin"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const scheduledAt = new Date(String(body.scheduledAt ?? ""));
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Choose a valid interview date and time." }, { status: 400 });
  }

  try {
    const interview = await scheduleOrUpdateInterview({
      applicationId: id,
      interviewId: body.interviewId ? String(body.interviewId) : undefined,
      scheduledAt,
      location: body.location ? String(body.location) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      userId: user.id,
      userRole: user.role as "hr" | "admin"
    });
    return NextResponse.json({ interview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Interview could not be saved.";
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "admin"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const interviewId = String(body.interviewId ?? "");
  const status = String(body.status ?? "") as InterviewStatus;
  if (!interviewId || !["pending", "scheduled", "completed", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Choose a valid interview and status." }, { status: 400 });
  }

  try {
    const interview = await updateInterviewStatus({
      applicationId: id,
      interviewId,
      status,
      notes: body.notes ? String(body.notes) : undefined,
      userId: user.id,
      userRole: user.role as "hr" | "admin"
    });
    return NextResponse.json({ interview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Interview could not be updated.";
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 400 });
  }
}
