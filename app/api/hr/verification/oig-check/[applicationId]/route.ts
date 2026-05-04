import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApi, AppError } from "@/services/monitoring/errorService";
import { checkApplicantAgainstOig, refreshOigDataset, getOigDatasetMetadata } from "@/services/verification/oigService";
import { getVerificationChecklist } from "@/services/verification/verificationService";

export const POST = withApi(
  { scope: "hr.verification.oig", entityType: "verificationChecklistItem", fallbackMessage: "Could not run OIG check." },
  async (_request: Request, { params }: { params: Promise<{ applicationId: string }> }) => {
    const user = await requireRole(["hr", "admin", "super_admin_hr"]);
    const { applicationId } = await params;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { applicantProfile: { include: { user: true } } }
    });
    if (!application) throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });

    // Auto-refresh dataset if it's missing or older than 7 days
    const meta = await getOigDatasetMetadata();
    const stale = !meta.lastUpdated || (Date.now() - meta.lastUpdated.getTime()) > 7 * 86400000;
    if (stale) {
      try {
        await refreshOigDataset();
      } catch (downloadError) {
        await logAction(user.id, "oig_dataset_download_failed", "application", applicationId, {
          error: downloadError instanceof Error ? downloadError.message : String(downloadError)
        });
      }
    }

    const fullName = (application.applicantProfile.user.name ?? "").trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.length > 0 ? rest[rest.length - 1] : "";

    const result = await checkApplicantAgainstOig({
      firstName: firstName ?? "",
      lastName,
      dateOfBirth: application.applicantProfile.dateOfBirth,
      state: application.applicantProfile.state
    });

    // Update the corresponding checklist item if it exists
    const checklist = await getVerificationChecklist(applicationId);
    let updatedItem = null;
    if (checklist) {
      const oigItem = checklist.items.find((item) => item.category === "oig_exclusion");
      if (oigItem) {
        const newStatus = !result.datasetLoaded
          ? "needs_followup"
          : result.matchType === "exact_with_dob"
            ? "failed"
            : result.matchType === "name_only"
              ? "needs_followup"
              : "verified";
        const resultText = !result.datasetLoaded
          ? "OIG dataset not yet downloaded; manual check required."
          : result.matchType === "exact_with_dob"
            ? `MATCH FOUND on OIG LEIE: name + DOB exact match. ${result.matches.length} record(s).`
            : result.matchType === "name_only"
              ? `Possible name match on OIG LEIE. ${result.matches.length} record(s) — HR must review (DOB did not match or applicant DOB missing).`
              : `No match on OIG LEIE (checked ${result.recordCount.toLocaleString()} records, dataset updated ${result.datasetLastUpdated?.toISOString().slice(0, 10) ?? "unknown"}).`;

        updatedItem = await prisma.verificationChecklistItem.update({
          where: { id: oigItem.id },
          data: {
            status: newStatus,
            result: resultText,
            verifiedByUserId: user.id,
            verifiedAt: new Date(),
            externalReferenceNumber: `OIG-LEIE-${result.datasetLastUpdated?.toISOString().slice(0, 10) ?? "manual"}`
          }
        });
      }
    }

    await logAction(user.id, "oig_check_run", "application", applicationId, {
      matched: result.matched,
      matchType: result.matchType,
      matchCount: result.matches.length,
      datasetRecords: result.recordCount,
      datasetLastUpdated: result.datasetLastUpdated?.toISOString() ?? null
    });

    return NextResponse.json({
      ok: true,
      result: {
        matched: result.matched,
        matchType: result.matchType,
        matches: result.matches.map((m) => ({
          firstName: m.firstName,
          lastName: m.lastName,
          middleName: m.middleName,
          state: m.state,
          dob: m.dob,
          exclusionType: m.exclusionType,
          exclusionDate: m.exclusionDate,
          specialty: m.specialty
        })),
        datasetLoaded: result.datasetLoaded,
        recordCount: result.recordCount,
        datasetLastUpdated: result.datasetLastUpdated
      },
      updatedChecklistItem: updatedItem
    });
  }
);
