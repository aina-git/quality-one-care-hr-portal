import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { processUploadedDocument } from "@/services/intake/intakeProcessor";
import { autoMapHighConfidenceFields } from "@/services/intake/mappingService";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

const AUTO_MAP_THRESHOLD = Number(process.env.AUTO_MAP_CONFIDENCE_THRESHOLD ?? 0.6);

// HR-triggered re-run of OCR + extraction + auto-mapping on every document
// attached to an application. Used to retro-fill structured fields for
// applicants that uploaded before auto-map was wired, or after fixing a
// regex / threshold and wanting fresh results.
//
// Two modes:
//  - default: full reprocess (OCR + extract + auto-map per document)
//  - ?mode=remap-only: skip OCR; just re-run auto-mapping over already-extracted fields
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(["admin", "super_admin_hr", "hr"]);
    const { id } = await params;
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") === "remap-only" ? "remap-only" : "full";

    const application = await prisma.application.findUnique({
      where: { id },
      include: { documents: { orderBy: { createdAt: "asc" } } }
    });
    if (!application) {
      throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });
    }

    let processedDocs = 0;
    if (mode === "full") {
      for (const doc of application.documents) {
        try {
          await processUploadedDocument(doc.id, actor.id);
          processedDocs += 1;
        } catch (err) {
          // Log and keep going — one bad document shouldn't kill the batch.
          await logAction(actor.id, "reprocess_document_failed", "uploaded_document", doc.id, {
            applicationId: id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    }

    const remap = await autoMapHighConfidenceFields(id, AUTO_MAP_THRESHOLD, actor.id);
    await logAction(actor.id, "admin.application_reprocessed", "application", id, {
      mode,
      processedDocs,
      mapped: remap.mapped,
      skipped: remap.skipped
    });

    return NextResponse.json({ ok: true, processedDocs, mapped: remap.mapped, skipped: remap.skipped, mode });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.reprocess",
      action: "reprocess",
      entityType: "application",
      fallbackMessage: "Could not reprocess application."
    });
  }
}
