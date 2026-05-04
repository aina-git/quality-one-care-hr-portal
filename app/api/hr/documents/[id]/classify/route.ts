import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security";
import { sendCommunication } from "@/services/communications/communicationService";

const actions = new Set(["assign", "irrelevant", "clarification"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "admin", "super_admin_hr"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = sanitizeText(body.action, 80);
  const documentType = sanitizeText(body.documentType, 120);
  const note = sanitizeText(body.note, 2000);
  if (!actions.has(action)) return NextResponse.json({ error: "Choose a valid document action." }, { status: 400 });

  const document = await prisma.uploadedDocument.findUnique({
    where: { id },
    include: { application: true }
  });
  if (!document?.applicationId || !document.application) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  const metadata = document.metadataJson && typeof document.metadataJson === "object" && !Array.isArray(document.metadataJson)
    ? document.metadataJson as Record<string, unknown>
    : {};

  const updated = await prisma.uploadedDocument.update({
    where: { id },
    data: {
      documentType: action === "assign" && documentType ? documentType : document.documentType,
      metadataJson: {
        ...metadata,
        organizationStatus: action === "assign" ? "assigned_by_hr" : action === "irrelevant" ? "irrelevant" : "clarification_requested",
        hrAssignedDocumentType: action === "assign" ? documentType : metadata.hrAssignedDocumentType ?? null,
        hrDocumentNote: note || null,
        reviewedByUserId: user.id,
        reviewedAt: new Date().toISOString()
      }
    }
  });

  if (action === "clarification") {
    await sendCommunication({
      applicationId: document.applicationId,
      senderId: user.id,
      senderRole: user.role,
      channel: "in_app",
      subject: "Clarification requested for uploaded document",
      body: note || `Please clarify the uploaded document: ${document.fileName}.`,
      visibleToApplicant: true
    });
  }

  await logAction(user.id, "unsorted_document_reviewed", "uploaded_document", id, {
    applicationId: document.applicationId,
    action,
    documentType,
    note
  });
  return NextResponse.json({ document: updated, message: "Document intake record updated." });
}
