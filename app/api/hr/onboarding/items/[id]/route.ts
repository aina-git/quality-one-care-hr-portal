import type { OnboardingItemStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { updateOnboardingItem } from "@/services/onboarding/onboardingService";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "super_admin_hr"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "") as OnboardingItemStatus;
  if (!["pending", "completed", "waived"].includes(status)) {
    return NextResponse.json({ error: "Choose a valid onboarding item status." }, { status: 400 });
  }

  try {
    const item = await updateOnboardingItem(id, status, user.id);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onboarding item could not be updated.";
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 400 });
  }
}
