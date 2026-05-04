import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApi, AppError } from "@/services/monitoring/errorService";
import { checkApplicantAgainstSam, refreshSamDataset, getSamDatasetMetadata } from "@/services/verification/samExclusionService";

export const POST = withApi(
  { scope: "hr.verification.sam", entityType: "application", fallbackMessage: "SAM exclusion check failed." },
  async (_request: Request, { params }: { params: Promise<{ applicationId: string }> }) => {
    const user = await requireRole(["hr", "admin", "super_admin_hr"]);
    const { applicationId } = await params;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { applicantProfile: { include: { user: true } } }
    });
    if (!application) throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });

    // Auto-refresh if missing or older than 7 days
    const meta = await getSamDatasetMetadata();
    const stale = !meta.lastUpdated || (Date.now() - meta.lastUpdated.getTime()) > 7 * 86400000;
    if (stale) {
      try {
        await refreshSamDataset();
      } catch (err) {
        await logAction(user.id, "sam_dataset_download_failed", "application", applicationId, {
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    const fullName = (application.applicantProfile.user.name ?? "").trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.length > 0 ? rest[rest.length - 1] : "";

    const result = await checkApplicantAgainstSam({
      firstName: firstName ?? "",
      lastName,
      state: application.applicantProfile.state
    });

    await logAction(user.id, "sam_check_run", "application", applicationId, {
      matched: result.matched,
      matchType: result.matchType,
      matchCount: result.matches.length
    });

    return NextResponse.json({ ok: true, result });
  }
);
