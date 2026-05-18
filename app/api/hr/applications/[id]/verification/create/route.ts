import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ensureFinalVerificationChecklist } from "@/services/verification/verificationService";
import { handleApiError } from "@/services/monitoring/errorService";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "super_admin_hr"]);
  const { id } = await params;

  try {
    const checklist = await ensureFinalVerificationChecklist(id, user.id);
    return NextResponse.json({ checklist });
  } catch (error) {
    return handleApiError(error, {
      scope: "verification.create",
      action: "final_verification_create_failed",
      userId: user.id,
      entityType: "application",
      entityId: id,
      fallbackMessage: error instanceof Error ? error.message : "Final verification checklist could not be created."
    });
  }
}
