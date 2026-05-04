import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { getAuthorizedDocument } from "@/services/authorization/accessService";
import { handleApiError } from "@/services/monitoring/errorService";
import { createSignedDocumentToken, getSignedDocumentUrl } from "@/services/storage/storageService";
import { publicUrl } from "@/lib/publicUrl";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const document = await getAuthorizedDocument(sanitizeText(id, 80), session.id, session.role);
    const cloudSignedUrl = await getSignedDocumentUrl(document.storageKey, 300);
    if (cloudSignedUrl) {
      await logAction(session.id, "document_access_requested", "uploaded_document", document.id, { via: "cloud_signed_url" });
      return NextResponse.redirect(cloudSignedUrl);
    }

    const expiresAt = Date.now() + 5 * 60 * 1000;
    const token = createSignedDocumentToken(document.id, session.id, expiresAt);
    await logAction(session.id, "document_access_requested", "uploaded_document", document.id, { via: "local_signed_url" });
    return NextResponse.redirect(publicUrl(`/api/documents/${document.id}?token=${encodeURIComponent(token)}`, request));
  } catch (error) {
    return handleApiError(error, {
      scope: "documents.signedUrl",
      action: "api_failure",
      userId: session.id,
      entityType: "uploaded_document",
      entityId: id,
      fallbackMessage: "Could not create document access URL."
    });
  }
}
