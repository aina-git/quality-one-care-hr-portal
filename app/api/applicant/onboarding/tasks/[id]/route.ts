import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateEmployeeOnboardingTask } from "@/services/onboarding/employeeOnboardingService";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["applicant"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "");
  if (status !== "completed") {
    return NextResponse.json({ error: "Applicants can only mark allowed tasks complete." }, { status: 400 });
  }

  const task = await prisma.onboardingTask.findUnique({
    where: { id },
    include: { onboarding: { include: { application: { include: { applicantProfile: true } } } } }
  });
  if (!task || task.onboarding.application.applicantProfile.userId !== user.id) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  if (!/review|complete|submit|required/i.test(task.title)) {
    return NextResponse.json({ error: "This task must be completed by HR." }, { status: 403 });
  }

  const updated = await updateEmployeeOnboardingTask({ taskId: id, userId: user.id, status: "completed" });
  return NextResponse.json({ task: updated });
}
