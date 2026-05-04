import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { sanitizeText } from "@/lib/security";
import { attachVerificationDocument } from "@/services/verification/verificationService";
import { handleApiError } from "@/services/monitoring/errorService";

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const user = await requireRole(["hr", "admin"]);
  const { itemId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const documentId = sanitizeText(body.documentId, 80);
    if (!documentId) return NextResponse.json({ error: "Choose an evidence document." }, { status: 400 });
    const item = await attachVerificationDocument(itemId, documentId, user.id);
    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError(error, {
      scope: "verification.attach_document",
      action: "verification_document_attach_failed",
      userId: user.id,
      entityType: "verification_item",
      entityId: itemId,
      fallbackMessage: error instanceof Error ? error.message : "Evidence document could not be attached."
    });
  }
}
