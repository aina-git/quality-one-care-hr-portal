/**
 * Pluggable framework for paid third-party verification providers.
 *
 * Each provider implements ExternalVerifier. They're registered in the registry below.
 * The verification UI lets HR trigger a provider's check; if the provider isn't
 * configured (no API key in env), the call returns a clean "not_configured" result
 * with instructions on what to set.
 *
 * To add a new provider:
 *   1. Create services/verification/providers/<name>.ts implementing ExternalVerifier
 *   2. Register it in EXTERNAL_VERIFIERS below
 *   3. Add corresponding env vars to .env.example
 *
 * Currently supported (stubs that respect env-var configuration):
 *   - Nursys e-Notify   (set NURSYS_API_KEY)
 *   - Checkr            (set CHECKR_API_KEY)
 *   - MD Court Records  (set MD_COURT_RECORDS_API_KEY, e.g. via TruDiligence)
 */

import type { VerificationCategory } from "@prisma/client";

export type VerifierStatus = "verified" | "match_found" | "not_configured" | "error" | "pending_human_review";

export type VerifierResult = {
  provider: string;
  category: VerificationCategory;
  status: VerifierStatus;
  resultText: string;
  externalReferenceNumber?: string;
  evidence?: Record<string, unknown>;
  raw?: unknown;
};

export type VerifierInput = {
  applicationId: string;
  applicantFirstName: string;
  applicantLastName: string;
  applicantMiddleName?: string | null;
  dateOfBirth?: Date | null;
  state?: string | null;
  licenseType?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
};

export interface ExternalVerifier {
  /** Stable id used in URLs and audit logs */
  id: string;
  /** Human-friendly name shown in UI */
  name: string;
  /** Which checklist category this verifier produces results for */
  category: VerificationCategory;
  /** What env var(s) configure this provider */
  requiredEnvVars: string[];
  /** Whether the verifier is currently usable (env vars set) */
  isConfigured(): boolean;
  /** Run the verification */
  run(input: VerifierInput): Promise<VerifierResult>;
}

// ─── Provider: Nursys e-Notify ────────────────────────────────────────
class NursysVerifier implements ExternalVerifier {
  id = "nursys";
  name = "Nursys e-Notify";
  category: VerificationCategory = "nursys";
  requiredEnvVars = ["NURSYS_API_KEY"];

  isConfigured(): boolean {
    return Boolean(process.env.NURSYS_API_KEY);
  }

  async run(input: VerifierInput): Promise<VerifierResult> {
    if (!this.isConfigured()) {
      return {
        provider: this.id,
        category: this.category,
        status: "not_configured",
        resultText: "Nursys e-Notify is not configured. Set NURSYS_API_KEY in environment to enable automated nursing license verification."
      };
    }

    // Production: call Nursys API. Subscription required (NCSBN account).
    // Endpoint: https://www.nursys.com/api/...
    // For now this is a stub that returns pending_human_review until Nursys subscription is wired.
    return {
      provider: this.id,
      category: this.category,
      status: "pending_human_review",
      resultText: `Nursys API key detected, but live integration pending implementation. Manual lookup required at https://www.nursys.com/LQC/LQCSearch.aspx with applicant ${input.applicantFirstName} ${input.applicantLastName}, license ${input.licenseNumber ?? "(not provided)"}.`,
      externalReferenceNumber: `nursys-pending-${Date.now()}`
    };
  }
}

// ─── Provider: Checkr (background checks) ─────────────────────────────
class CheckrVerifier implements ExternalVerifier {
  id = "checkr";
  name = "Checkr Background Check";
  category: VerificationCategory = "background_check_cgis";
  requiredEnvVars = ["CHECKR_API_KEY"];

  isConfigured(): boolean {
    return Boolean(process.env.CHECKR_API_KEY);
  }

  async run(input: VerifierInput): Promise<VerifierResult> {
    if (!this.isConfigured()) {
      return {
        provider: this.id,
        category: this.category,
        status: "not_configured",
        resultText: "Checkr is not configured. Set CHECKR_API_KEY in environment to enable automated background checks. Note: a healthcare-eligible Checkr account with signed BAA is required."
      };
    }
    return {
      provider: this.id,
      category: this.category,
      status: "pending_human_review",
      resultText: `Checkr API key detected, but live integration pending implementation. Subscription requires applicant consent flow and adverse-action workflow per FCRA.`,
      externalReferenceNumber: `checkr-pending-${Date.now()}`
    };
  }
}

// ─── Provider: MD Court Records aggregator (e.g. TruDiligence) ────────
class MdCourtRecordsVerifier implements ExternalVerifier {
  id = "md_court_records";
  name = "Maryland Court Records (aggregator)";
  category: VerificationCategory = "maryland_case_search";
  requiredEnvVars = ["MD_COURT_RECORDS_API_KEY"];

  isConfigured(): boolean {
    return Boolean(process.env.MD_COURT_RECORDS_API_KEY);
  }

  async run(input: VerifierInput): Promise<VerifierResult> {
    if (!this.isConfigured()) {
      return {
        provider: this.id,
        category: this.category,
        status: "not_configured",
        resultText: "Maryland Court Records aggregator is not configured. Set MD_COURT_RECORDS_API_KEY (e.g. TruDiligence, Backgrounds Online) to enable automated MD case search. Direct scraping of casesearch.courts.state.md.us is prohibited by their terms of use."
      };
    }
    return {
      provider: this.id,
      category: this.category,
      status: "pending_human_review",
      resultText: `MD Court Records API key detected, but live integration pending. Manual lookup at http://casesearch.courts.state.md.us/casesearch/ with applicant ${input.applicantFirstName} ${input.applicantLastName} until aggregator is wired.`,
      externalReferenceNumber: `md-court-pending-${Date.now()}`
    };
  }
}

// ─── Registry ─────────────────────────────────────────────────────────
export const EXTERNAL_VERIFIERS: ExternalVerifier[] = [
  new NursysVerifier(),
  new CheckrVerifier(),
  new MdCourtRecordsVerifier()
];

export function getVerifier(id: string): ExternalVerifier | undefined {
  return EXTERNAL_VERIFIERS.find((v) => v.id === id);
}

export function getVerifiersForCategory(category: VerificationCategory): ExternalVerifier[] {
  return EXTERNAL_VERIFIERS.filter((v) => v.category === category);
}

export function summarizeProviders() {
  return EXTERNAL_VERIFIERS.map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category,
    requiredEnvVars: v.requiredEnvVars,
    isConfigured: v.isConfigured()
  }));
}
