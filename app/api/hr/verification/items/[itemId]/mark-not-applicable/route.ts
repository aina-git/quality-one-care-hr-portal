import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { sanitizeText } from "@/lib/security";
import { updateVerificationItem } from "@/services/verification/verificationService";
import { handleApiError } from "@/services/monitoring/errorService";

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const user = await requireRole(["hr", "super_admin_hr"]);
  const { itemId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const notes = sanitizeText(body.notes, 4000);
    if (!notes) return NextResponse.json({ error: "A note is required when marking an item not applicable." }, { status: 400 });
    const item = await updateVerificationItem({ itemId, userId: user.id, status: "not_applicable", notes });
    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError(error, {
      scope: "verification.not_applicable",
      action: "verification_item_update_failed",
      userId: user.id,
      entityType: "verification_item",
      entityId: itemId,
      fallbackMessage: error instanceof Error ? error.message : "Verification item could not be marked not applicable."
    });
  }
}
