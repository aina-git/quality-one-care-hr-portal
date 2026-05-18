import type { OnboardingTaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { updateEmployeeOnboardingTask } from "@/services/onboarding/employeeOnboardingService";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "super_admin_hr"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "") as OnboardingTaskStatus;
  if (!["pending", "completed", "waived"].includes(status)) {
    return NextResponse.json({ error: "Choose a valid onboarding task status." }, { status: 400 });
  }

  try {
    const task = await updateEmployeeOnboardingTask({ taskId: id, userId: user.id, status });
    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onboarding task could not be updated.";
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 400 });
  }
}
