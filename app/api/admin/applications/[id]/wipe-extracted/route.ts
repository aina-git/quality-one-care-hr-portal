import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

// Destructive cleanup — wipes everything that originated from the OCR /
// auto-extract pipeline so HR can re-run extraction cleanly after a
// pattern change. Does NOT touch:
//   - User.name / User.email (those come from registration, not OCR)
//   - the uploaded document files themselves
//   - HRDecisions, AIReviewReports, ValidationIssues, audit log
//
// Wipes:
//   - ApplicantProfile.phone, dateOfBirth, address, city, state, zip,
//     pediatricExperience  (set to null)
//   - All EmploymentHistory rows for the application
//   - All License rows for the application
//   - All Certification rows for the application
//   - All Reference rows for the application
//   - All ExtractedField rows for the application
//   - All DocumentExtraction rows (raw OCR text + parsed fields)
//
// Use this when auto-mapped data is wrong and you want a fresh start. Pair
// with /reprocess afterward to re-run OCR with new field-extractor patterns.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(["super_admin_hr"]);
    const { id } = await params;

    const application = await prisma.application.findUnique({
      where: { id },
      select: { id: true, applicantProfileId: true }
    });
    if (!application) {
      throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });
    }

    const counts = await prisma.$transaction(async (tx) => {
      const e = await tx.employmentHistory.deleteMany({ where: { applicationId: id } });
      const l = await tx.license.deleteMany({ where: { applicationId: id } });
      const c = await tx.certification.deleteMany({ where: { applicationId: id } });
      const r = await tx.reference.deleteMany({ where: { applicationId: id } });
      const f = await tx.extractedField.deleteMany({ where: { applicationId: id } });
      const x = await tx.documentExtraction.deleteMany({ where: { applicationId: id } });
      await tx.applicantProfile.update({
        where: { id: application.applicantProfileId },
        data: {
          phone: null,
          dateOfBirth: null,
          address: null,
          city: null,
          state: null,
          zip: null,
          pediatricExperience: null
        }
      });
      return {
        employmentHistory: e.count,
        licenses: l.count,
        certifications: c.count,
        references: r.count,
        extractedFields: f.count,
        documentExtractions: x.count
      };
    });

    await logAction(actor.id, "admin.application_extracted_data_wiped", "application", id, counts);
    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.wipe-extracted",
      action: "wipe",
      entityType: "application",
      fallbackMessage: "Could not wipe extracted data."
    });
  }
}
