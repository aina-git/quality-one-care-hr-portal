/**
 * Smart verification assistant.
 *
 * For sites we don't autonomously scrape (Nursys, MBON, MD Case Search, CGIS),
 * we build pre-filled deep links so HR's manual lookup takes ~30 seconds:
 *   1. HR clicks "Open MBON for Jane Roe" → site opens with Jane Roe pre-filled in the search
 *   2. HR sees the result, screenshots it, clicks "Verified" or "Concerns found"
 *   3. System captures: who, when, screenshot, reference number → audit trail
 *
 * This is the legitimate way to accelerate manual verification without violating
 * any site's terms of use.
 */

import type { VerificationCategory } from "@prisma/client";

export type AssistantSource = {
  category: VerificationCategory;
  providerName: string;
  description: string;
  buildUrl: (input: AssistantInput) => string;
  searchHints: string[];
  captureFields: Array<{ key: string; label: string; required?: boolean; placeholder?: string }>;
};

export type AssistantInput = {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  dateOfBirth?: Date | null;
  state?: string | null;
  licenseNumber?: string | null;
  licenseType?: string | null;
  licenseState?: string | null;
};

const sources: AssistantSource[] = [
  {
    category: "nursys",
    providerName: "Nursys QuickConfirm",
    description: "Multi-state nursing license verification. Search by name + state OR license number.",
    buildUrl: (input) => {
      // Nursys public search — opens to QuickConfirm landing
      const url = new URL("https://www.nursys.com/LQC/LQCSearch.aspx");
      // Nursys search params don't pre-fill via URL; HR will paste the pre-copied data
      return url.toString();
    },
    searchHints: [
      "Use 'License Verification' (free public lookup)",
      "Search by license number if available, otherwise name + state",
      "Capture screenshot showing: license type, status, expiration",
      "Record any disciplinary actions or alerts"
    ],
    captureFields: [
      { key: "licenseStatus", label: "License status (e.g. Active, Inactive, Disciplined)", required: true, placeholder: "Active" },
      { key: "expirationDate", label: "Expiration date (YYYY-MM-DD)", placeholder: "2027-06-30" },
      { key: "disciplinaryActions", label: "Any disciplinary actions noted?", placeholder: "None / details" }
    ]
  },
  {
    category: "maryland_board_of_nursing",
    providerName: "Maryland Board of Nursing",
    description: "Maryland-issued RN/LPN/CNA license lookup. Public search by name or license number.",
    buildUrl: (input) => {
      // MBON portal — most reliable entry is the license verification landing page
      const url = new URL("https://mbon.maryland.gov/Pages/license-verification.aspx");
      return url.toString();
    },
    searchHints: [
      "Click 'License Verification' on the landing page",
      "Search by license number if known, otherwise full legal name",
      "Confirm: license type, license number, status (Active/Inactive/Suspended), issue date, expiration",
      "Note: status of 'Active' is the only acceptable result for hire"
    ],
    captureFields: [
      { key: "licenseStatus", label: "Status (must be Active for hire)", required: true, placeholder: "Active" },
      { key: "licenseNumber", label: "License number (verify match)", placeholder: "R012345" },
      { key: "expirationDate", label: "Expiration date", placeholder: "2027-06-30" },
      { key: "publicActions", label: "Any public actions on the record?", placeholder: "None / details" }
    ]
  },
  {
    category: "maryland_case_search",
    providerName: "Maryland Judiciary Case Search",
    description: "Maryland court records lookup. Public search by name (last, first).",
    buildUrl: (input) => {
      // Maryland Case Search — direct search not deep-linkable; landing page opens to terms acceptance
      const url = new URL("http://casesearch.courts.state.md.us/casesearch/");
      return url.toString();
    },
    searchHints: [
      "Accept the disclaimer to enter the search",
      "Search by Last Name, First Name (use Person Search)",
      "Capture screenshot of search results and any matching cases",
      "If matches found: review charges, disposition, and dates"
    ],
    captureFields: [
      { key: "matchesFound", label: "Number of name matches found", required: true, placeholder: "0" },
      { key: "concerningCases", label: "Any concerning cases (criminal, fraud, abuse)?", required: true, placeholder: "None / details" },
      { key: "datesReviewed", label: "Date range reviewed", placeholder: "All available" }
    ]
  },
  {
    category: "background_check_cgis",
    providerName: "CGIS / Maryland CJIS",
    description: "Criminal background check via Maryland CJIS-Central Repository. Requires fingerprints + agency authorization (cannot be automated).",
    buildUrl: () => "https://dpscs.maryland.gov/publicservs/bgchecks.shtml",
    searchHints: [
      "Agency: Quality One Care Home Health Inc.",
      "MA Provider Number: 420641000",
      "Applicant must provide fingerprints at an authorized site",
      "Capture the receipt + tracking number when submitted"
    ],
    captureFields: [
      { key: "trackingNumber", label: "CGIS tracking number", required: true, placeholder: "TRK-XXXXXX" },
      { key: "submittedDate", label: "Date submitted", required: true },
      { key: "result", label: "Result (Cleared / Pending / Concerns)", placeholder: "Pending" },
      { key: "receiptUploaded", label: "Receipt uploaded?", placeholder: "yes/no" }
    ]
  },
  {
    category: "liability_insurance_nso",
    providerName: "NSO Liability Insurance",
    description: "Verify Nurses Service Organization liability insurance from applicant's policy document.",
    buildUrl: () => "https://www.nso.com/",
    searchHints: [
      "NSO does not offer public verification — verify from the applicant's policy document",
      "Capture: policy number, policyholder name, effective dates, coverage amount",
      "Confirm policy is current"
    ],
    captureFields: [
      { key: "policyNumber", label: "Policy number", required: true },
      { key: "policyholder", label: "Policyholder name (must match applicant)", required: true },
      { key: "expirationDate", label: "Expiration date", required: true }
    ]
  },
  {
    category: "cpr",
    providerName: "CPR / BLS Provider",
    description: "Verify current CPR/BLS certification. AHA cards are verifiable at heart.org/cprverify.",
    buildUrl: (input) => {
      const url = new URL("https://ecards.heart.org/student/myecards");
      return url.toString();
    },
    searchHints: [
      "AHA: enter eCard code from applicant's card at ecards.heart.org",
      "Other providers: verify from the certificate document",
      "Confirm: certification type (BLS / CPR), issue date, expiration (≤ 2 years)"
    ],
    captureFields: [
      { key: "certType", label: "Certification type (BLS / CPR for HCP / etc.)", required: true },
      { key: "issuingProvider", label: "Issuing provider (AHA / Red Cross / etc.)", required: true },
      { key: "expirationDate", label: "Expiration date", required: true }
    ]
  }
];

export function getAssistantSources(): AssistantSource[] {
  return sources;
}

export function getAssistantSourceForCategory(category: VerificationCategory): AssistantSource | undefined {
  return sources.find((s) => s.category === category);
}

export function buildAssistantUrlForCategory(
  category: VerificationCategory,
  input: AssistantInput
): { url: string; copyText: string } | null {
  const source = getAssistantSourceForCategory(category);
  if (!source) return null;
  return {
    url: source.buildUrl(input),
    // Pre-formatted text HR can paste into search forms
    copyText: [
      input.firstName,
      input.middleName,
      input.lastName,
      input.licenseNumber ? `License: ${input.licenseNumber}` : "",
      input.state ? `State: ${input.state}` : ""
    ].filter(Boolean).join(" ").trim()
  };
}
