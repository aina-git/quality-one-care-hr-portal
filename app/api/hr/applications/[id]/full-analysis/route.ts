import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApi, AppError } from "@/services/monitoring/errorService";
import { runApplicationReview } from "@/services/review/reviewOrchestrator";
import { runCrossValidation } from "@/services/verification/crossValidationService";
import { checkApplicantAgainstOig, refreshOigDataset, getOigDatasetMetadata } from "@/services/verification/oigService";
import { ensureFinalVerificationChecklist, getVerificationChecklist } from "@/services/verification/verificationService";

/**
 * One-click "AI does everything" endpoint for the HR review page.
 *
 * Runs the four AI/verification checks in parallel:
 *   1. AI review report (rule-based engine; LLM later)
 *   2. Identity cross-validation (compare applicant data across documents)
 *   3. OIG LEIE federal exclusion check
 *   4. Ensures verification checklist exists for tracking
 *
 * Returns a consolidated result HR can view on the review page,
 * informing the green/amber/red decision.
 */
export const POST = withApi(
  { scope: "hr.full_analysis", entityType: "application", fallbackMessage: "Could not run analysis." },
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireRole(["hr", "admin", "super_admin_hr"]);
    const { id } = await params;

    const application = await prisma.application.findUnique({
      where: { id },
      include: { applicantProfile: { include: { user: true } } }
    });
    if (!application) throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });

    // Auto-refresh OIG dataset if stale
    const oigMeta = await getOigDatasetMetadata();
    const stale = !oigMeta.lastUpdated || (Date.now() - oigMeta.lastUpdated.getTime()) > 7 * 86400000;
    if (stale) {
      try { await refreshOigDataset(); } catch {
        // Soft-fail: cross-validation and AI review still run
      }
    }

    const fullName = (application.applicantProfile.user.name ?? "").trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.length > 0 ? rest[rest.length - 1] : "";

    // Run all three checks in parallel — they're independent
    const [aiReport, crossValidation, oigResult] = await Promise.all([
      runApplicationReview(id, user.id).catch((err) => ({ error: err instanceof Error ? err.message : String(err) })),
      runCrossValidation(id).catch((err) => ({ error: err instanceof Error ? err.message : String(err) })),
      checkApplicantAgainstOig({
        firstName: firstName ?? "",
        lastName,
        dateOfBirth: application.applicantProfile.dateOfBirth,
        state: application.applicantProfile.state
      }).catch((err) => ({ error: err instanceof Error ? err.message : String(err) }))
    ]);

    // Ensure verification checklist exists for tracking
    await ensureFinalVerificationChecklist(id, user.id).catch(() => null);
    const checklist = await getVerificationChecklist(id);

    // If OIG check produced a definitive result, auto-update the OIG checklist item
    if (checklist && oigResult && "matched" in oigResult && oigResult.datasetLoaded) {
      const oigItem = checklist.items.find((item) => item.category === "oig_exclusion");
      if (oigItem) {
        const newStatus =
          oigResult.matchType === "exact_with_dob" ? "failed" :
          oigResult.matchType === "name_only" ? "needs_followup" :
          "verified";
        const resultText =
          oigResult.matchType === "exact_with_dob"
            ? `MATCH FOUND on OIG LEIE: name + DOB exact match. ${oigResult.matches.length} record(s).`
            : oigResult.matchType === "name_only"
              ? `Possible name match on OIG LEIE. ${oigResult.matches.length} record(s) — HR review required.`
              : `No match on OIG LEIE (checked ${oigResult.recordCount.toLocaleString()} records).`;
        await prisma.verificationChecklistItem.update({
          where: { id: oigItem.id },
          data: {
            status: newStatus,
            result: resultText,
            verifiedByUserId: user.id,
            verifiedAt: new Date(),
            externalReferenceNumber: `OIG-LEIE-${oigResult.datasetLastUpdated?.toISOString().slice(0, 10) ?? "auto"}`
          }
        });
      }
    }

    const isErr = (v: unknown): v is { error: string } =>
      Boolean(v && typeof v === "object" && "error" in v);
    await logAction(user.id, "hr_full_analysis_run", "application", id, {
      aiOk: !isErr(aiReport),
      crossValOk: !isErr(crossValidation),
      oigOk: !isErr(oigResult)
    });

    return NextResponse.json({
      ok: true,
      aiReport,
      crossValidation,
      oig: oigResult
    });
  }
);
