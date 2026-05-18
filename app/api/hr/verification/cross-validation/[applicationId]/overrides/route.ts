import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { handleApiError } from "@/services/monitoring/errorService";
import { sanitizeText } from "@/lib/security";

const VALID_FIELDS = new Set(["name", "dateOfBirth", "licenseNumber", "licenseType", "address"]);

export async function POST(request: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    const user = await requireRole(["hr", "super_admin_hr"]);
    const { applicationId } = await ctx.params;
    const body = await request.json().catch(() => ({}));

    const field = String(body.field ?? "").trim();
    if (!VALID_FIELDS.has(field)) {
      return NextResponse.json({ error: "Unknown cross-check field." }, { status: 400 });
    }
    const documentId = body.documentId ? String(body.documentId) : null;
    const reason = sanitizeText(body.reason ?? "", 2000);
    if (!reason.trim()) {
      return NextResponse.json({ error: "Reason is required to override a cross-check finding." }, { status: 400 });
    }
    const applicationValue = body.applicationValue ? sanitizeText(body.applicationValue, 1000) : null;
    const documentValue = body.documentValue ? sanitizeText(body.documentValue, 1000) : null;

    const application = await prisma.application.findUnique({ where: { id: applicationId }, select: { id: true } });
    if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

    if (documentId) {
      const doc = await prisma.uploadedDocument.findUnique({ where: { id: documentId }, select: { id: true, applicationId: true } });
      if (!doc || doc.applicationId !== applicationId) {
        return NextResponse.json({ error: "Document does not belong to this application." }, { status: 400 });
      }
    }

    // Revoke any prior active override for the same (field, documentId) to keep
    // exactly one active override per finding while preserving audit history.
    // Wrapping in a transaction prevents two concurrent HR users from both
    // creating active overrides for the same finding.
    const created = await prisma.$transaction(async (tx) => {
      await tx.crossCheckOverride.updateMany({
        where: { applicationId, field, documentId, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: user.id, revokedReason: "Superseded by new override" }
      });
      return tx.crossCheckOverride.create({
        data: {
          applicationId,
          field,
          documentId,
          applicationValue,
          documentValue,
          reason,
          overriddenById: user.id
        }
      });
    });

    await logAction(user.id, "cross_check_override_created", "application", applicationId, {
      overrideId: created.id,
      field,
      documentId
    });

    return NextResponse.json({ ok: true, overrideId: created.id });
  } catch (error) {
    return handleApiError(error, {
      scope: "hr.crossCheckOverride",
      action: "post",
      entityType: "crossCheckOverride",
      fallbackMessage: "Could not record override."
    });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    const user = await requireRole(["hr", "super_admin_hr"]);
    const { applicationId } = await ctx.params;
    const url = new URL(request.url);
    const overrideId = url.searchParams.get("id");
    if (!overrideId) return NextResponse.json({ error: "Override id is required." }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const revokedReason = body.reason ? sanitizeText(body.reason, 2000) : null;

    const existing = await prisma.crossCheckOverride.findUnique({ where: { id: overrideId } });
    if (!existing || existing.applicationId !== applicationId) {
      return NextResponse.json({ error: "Override not found." }, { status: 404 });
    }
    if (existing.revokedAt) {
      return NextResponse.json({ error: "Override is already revoked." }, { status: 400 });
    }

    await prisma.crossCheckOverride.update({
      where: { id: overrideId },
      data: {
        revokedAt: new Date(),
        revokedById: user.id,
        revokedReason
      }
    });

    await logAction(user.id, "cross_check_override_revoked", "application", applicationId, {
      overrideId,
      field: existing.field,
      documentId: existing.documentId
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, {
      scope: "hr.crossCheckOverride",
      action: "delete",
      entityType: "crossCheckOverride",
      fallbackMessage: "Could not revoke override."
    });
  }
}
