import type { ExternalVerificationType, VerificationItemStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { sanitizeText } from "@/lib/security";
import {
  recordExternalVerification,
  updateVerificationItem
} from "@/services/verification/verificationService";
import { handleApiError } from "@/services/monitoring/errorService";

const itemStatuses = ["not_started", "pending", "pending_external_check", "verified", "failed", "expired", "not_applicable", "needs_followup"];
const verificationTypes = ["maryland_board_of_nursing", "nursys", "maryland_case_search", "oig", "cgis", "nso", "cpr", "other"];

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const user = await requireRole(["hr", "admin"]);
  const { itemId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const statusValue = sanitizeText(body.status, 80);
    const status = itemStatuses.includes(statusValue) ? statusValue as VerificationItemStatus : undefined;
    const expirationValue = sanitizeText(body.expirationDate, 40);
    const expirationDate = expirationValue ? new Date(expirationValue) : undefined;
    if (expirationDate && Number.isNaN(expirationDate.getTime())) {
      return NextResponse.json({ error: "Choose a valid expiration date." }, { status: 400 });
    }

    const updated = await updateVerificationItem({
      itemId,
      userId: user.id,
      status,
      result: body.result,
      expirationDate,
      externalReferenceNumber: body.externalReferenceNumber,
      notes: body.notes,
      documentId: body.documentId ? sanitizeText(body.documentId, 80) : undefined
    });

    const verificationTypeValue = sanitizeText(body.verificationType, 80);
    if (verificationTypes.includes(verificationTypeValue) && (body.providerName || body.searchUrl || body.trackingNumber || body.externalResult)) {
      await recordExternalVerification({
        itemId,
        userId: user.id,
        verificationType: verificationTypeValue as ExternalVerificationType,
        providerName: sanitizeText(body.providerName, 200) || verificationTypeValue,
        searchUrl: body.searchUrl,
        searchDate: body.searchDate ? new Date(String(body.searchDate)) : new Date(),
        applicantNameUsed: body.applicantNameUsed,
        licenseNumberUsed: body.licenseNumberUsed,
        trackingNumber: body.trackingNumber,
        result: body.externalResult || body.result,
        notes: body.externalNotes || body.notes,
        evidenceDocumentId: body.documentId ? sanitizeText(body.documentId, 80) : undefined
      });
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    return handleApiError(error, {
      scope: "verification.update",
      action: "verification_item_update_failed",
      userId: user.id,
      entityType: "verification_item",
      entityId: itemId,
      fallbackMessage: error instanceof Error ? error.message : "Verification item could not be updated."
    });
  }
}
