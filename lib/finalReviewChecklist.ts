/**
 * Final Review Sheet — the 12-item verification checklist that mirrors the
 * Quality One Care paper "Table of Checklist for Employment Verification".
 *
 * Order matches the physical form. Each row maps to a VerificationCategory
 * (or a combined pair of categories) so the existing checklist data feeds
 * directly into the new layout — no schema migration required.
 */

import type { VerificationCategory } from "@prisma/client";

export type FinalReviewRow = {
  index: number;
  title: string;
  description?: string;
  /**
   * Categories that contribute to this row. If multiple, the row aggregates
   * status across them (worst-case wins for status display).
   */
  categories: VerificationCategory[];
  /** Whether this row has an autonomous AI/data check the system can run */
  autonomous?: "oig" | null;
};

export const FINAL_REVIEW_ROWS: FinalReviewRow[] = [
  {
    index: 1,
    title: "Employment History",
    description: "Must have at least 1 year of clinical experience involving pediatric patients within the past 2 years.",
    categories: ["employment_history"]
  },
  {
    index: 2,
    title: "2 Professional Employment Verifications",
    description: "Two verifiable professional employment references confirmed.",
    categories: ["professional_employment_verification"]
  },
  {
    index: 3,
    title: "Character Reference",
    description: "Supervisor-level or higher preferred.",
    categories: ["character_reference"]
  },
  {
    index: 4,
    title: "Background Check (CGIS)",
    description: "Maryland CJIS / fingerprint-based background check. Tracking number and receipt required.",
    categories: ["background_check_cgis"]
  },
  {
    index: 5,
    title: "OIG Exclusion List",
    description: "Federal OIG List of Excluded Individuals/Entities (LEIE). Auto-checked against ~83K records.",
    categories: ["oig_exclusion"],
    autonomous: "oig"
  },
  {
    index: 6,
    title: "Maryland Case Search",
    description: "Maryland Judiciary court records search for the applicant's legal name.",
    categories: ["maryland_case_search"]
  },
  {
    index: 7,
    title: "Annual Physical Health Form (incl. TB Test / Chest X-ray)",
    description: "Current annual physical signed by physician, plus TB skin test or chest X-ray within the past year.",
    categories: ["annual_physical_health", "tb_test_or_chest_xray"]
  },
  {
    index: 8,
    title: "Liability Insurance (NSO)",
    description: "Nurses Service Organization or equivalent malpractice/liability insurance, current.",
    categories: ["liability_insurance_nso"]
  },
  {
    index: 9,
    title: "Current and Active Nursing License",
    description: "RN or LPN license, current and active. Confirm via Nursys + Maryland Board of Nursing.",
    categories: ["nursys", "maryland_board_of_nursing"]
  },
  {
    index: 10,
    title: "Current and Active CPR",
    description: "BLS / CPR for Healthcare Providers, current (not expired).",
    categories: ["cpr"]
  },
  {
    index: 11,
    title: "Current and Non-expired State ID / Driver's License",
    description: "State-issued photo ID or driver's license, non-expired.",
    categories: ["id_or_work_authorization"]
  },
  {
    index: 12,
    title: "Current and Non-expired Green Card / Work Authorization / Passport",
    description: "Proof of right to work in the US, non-expired.",
    categories: ["id_or_work_authorization"]
  },
  {
    index: 13,
    title: "KanTime Training",
    description: "KanTime EHR onboarding training completed.",
    categories: ["sanitation_training"] // Reusing existing category slot for KanTime tracking
  }
];

export const AGENCY_INFO = {
  name: "Quality One Care Home Health Inc.",
  maProviderNumber: "420641000",
  verificationEmail: "qualityonecare39@gmail.com"
};
