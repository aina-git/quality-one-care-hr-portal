import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApi, AppError } from "@/services/monitoring/errorService";
import { getVerifier } from "@/services/verification/externalVerifierFramework";
import { getVerificationChecklist } from "@/services/verification/verificationService";

export const POST = withApi(
  { scope: "hr.verification.external", entityType: "verificationChecklistItem", fallbackMessage: "External verification failed." },
  async (_request: Request, { params }: { params: Promise<{ verifierId: string; applicationId: string }> }) => {
    const user = await requireRole(["hr", "admin", "super_admin_hr"]);
    const { verifierId, applicationId } = await params;

    const verifier = getVerifier(verifierId);
    if (!verifier) throw new AppError("Unknown external verifier.", { statusCode: 404, code: "NOT_FOUND" });

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
    const license = application.licenses[0];

    const result = await verifier.run({
      applicationId,
      applicantFirstName: firstName ?? "",
      applicantLastName: lastName,
      dateOfBirth: application.applicantProfile.dateOfBirth,
      state: application.applicantProfile.state,
      licenseType: license?.type,
      licenseNumber: license?.licenseNumber,
      licenseState: license?.issuingState
    });

    // If the verifier produced a result, sync it to the matching checklist item
    let updatedItem = null;
    if (result.status !== "not_configured") {
      const checklist = await getVerificationChecklist(applicationId);
      const item = checklist?.items.find((it) => it.category === verifier.category);
      if (item) {
        const itemStatus =
          result.status === "verified" ? "verified" :
          result.status === "match_found" ? "failed" :
          result.status === "error" ? "needs_followup" :
          "pending_external_check";
        updatedItem = await prisma.verificationChecklistItem.update({
          where: { id: item.id },
          data: {
            status: itemStatus,
            result: result.resultText,
            verifiedByUserId: user.id,
            verifiedAt: new Date(),
            externalReferenceNumber: result.externalReferenceNumber ?? `${verifier.id}-${Date.now()}`
          }
        });
      }
    }

    await logAction(user.id, "external_verification_run", "application", applicationId, {
      verifier: verifier.id,
      status: result.status,
      reference: result.externalReferenceNumber ?? null
    });

    return NextResponse.json({ ok: true, result, updatedChecklistItem: updatedItem });
  }
);
