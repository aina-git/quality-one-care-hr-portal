import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { getAuthorizedDocument } from "@/services/authorization/accessService";
import { handleApiError } from "@/services/monitoring/errorService";
import { resolveDocumentPath, verifySignedDocumentToken } from "@/services/storage/storageService";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";

  try {
    const document = await getAuthorizedDocument(sanitizeText(id, 80), session.id, session.role);
    if (!verifySignedDocumentToken(document.id, session.id, token)) {
      return NextResponse.json({ error: "Document access token is invalid or expired." }, { status: 403 });
    }

    // Manual Entry / placeholder documents have no underlying file —
    // serve a friendly explanation page instead of a 500 error.
    if (document.documentType === "Manual Entry" || document.storageKey === "manual-entry") {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${document.fileName}</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;max-width:600px;margin:0 auto;color:#0f172a}
.box{border:1px solid #cbd5e1;background:#f8fafc;border-radius:12px;padding:24px;margin-top:20px}
h1{color:#ea580c;font-size:24px;margin:0 0 8px} p{line-height:1.6;color:#475569}
.label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8}</style></head>
<body><p class="label">Quality One Care</p><h1>${document.fileName}</h1>
<div class="box"><p><strong>This is a manual entry record, not an uploaded file.</strong></p>
<p>The applicant or HR typed these field values directly during intake review rather than uploading a document. The values are stored as structured fields on the application — open the applicant's review page to see them.</p>
</div></body></html>`;
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store"
        }
      });
    }

    const absolutePath = await resolveDocumentPath(document.storageKey);
    const file = await fs.readFile(absolutePath);
    await logAction(session.id, "document_accessed", "uploaded_document", document.id, { storageKey: document.storageKey });
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${document.fileName}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return handleApiError(error, {
      scope: "documents.read",
      action: "api_failure",
      userId: session.id,
      entityType: "uploaded_document",
      entityId: id,
      fallbackMessage: "Document could not be opened."
    });
  }
}
