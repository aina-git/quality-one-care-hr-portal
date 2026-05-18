import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApi, AppError } from "@/services/monitoring/errorService";
import { lookupNpi } from "@/services/verification/npiRegistryService";

export const POST = withApi(
  { scope: "hr.verification.npi", entityType: "application", fallbackMessage: "NPI lookup failed." },
  async (_request: Request, { params }: { params: Promise<{ applicationId: string }> }) => {
    const user = await requireRole(["hr", "super_admin_hr"]);
    const { applicationId } = await params;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        applicantProfile: { include: { user: true } },
        licenses: true
      }
    });
    if (!application) throw new AppError("Application not found.", { statusCode: 404, code: "NOT_FOUND" });

    const fullName = (application.applicantProfile.user.name ?? "").trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.length > 0 ? rest[rest.length - 1] : "";
    const state = application.applicantProfile.state;
    const license = application.licenses[0];

    // Try NPI number first if available, otherwise name + state
    const result = await lookupNpi({
      npi: license?.licenseNumber && /^\d{10}$/.test(license.licenseNumber) ? license.licenseNumber : null,
      firstName,
      lastName,
      state
    });

    await logAction(user.id, "npi_lookup_run", "application", applicationId, {
      found: result.found,
      resultCount: result.resultCount,
      query: result.query
    });

    return NextResponse.json({ ok: true, result });
  }
);
