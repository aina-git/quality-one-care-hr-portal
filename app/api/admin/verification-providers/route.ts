import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { withApi } from "@/services/monitoring/errorService";
import { summarizeProviders } from "@/services/verification/externalVerifierFramework";
import { getOigDatasetMetadata } from "@/services/verification/oigService";

export const GET = withApi(
  { scope: "admin.verification.providers", entityType: "verificationProvider", fallbackMessage: "Could not load providers." },
  async () => {
    await requireRole(["admin", "super_admin_hr", "executive_view_only"]);
    const providers = summarizeProviders();
    const oigMeta = await getOigDatasetMetadata();
    return NextResponse.json({
      builtInVerifiers: [
        {
          id: "oig",
          name: "OIG LEIE (Federal Exclusions)",
          category: "oig_exclusion",
          isConfigured: true,
          datasetLastUpdated: oigMeta.lastUpdated,
          datasetRecordCount: oigMeta.recordCount,
          notes: "Public federal dataset. No API key required."
        },
        {
          id: "cross_validation",
          name: "Identity Cross-Validation",
          category: "internal",
          isConfigured: true,
          notes: "Compares applicant data across uploaded documents (name, DOB, license, address)."
        },
        {
          id: "credential_expiration",
          name: "Credential Expiration Monitor",
          category: "internal",
          isConfigured: true,
          notes: "Daily scan flagging expired/expiring licenses, certifications, and verification items."
        }
      ],
      externalVerifiers: providers
    });
  }
);
