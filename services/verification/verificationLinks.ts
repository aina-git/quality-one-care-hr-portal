import type { ExternalVerificationType, VerificationCategory } from "@prisma/client";

export type VerificationLink = {
  category: VerificationCategory;
  verificationType: ExternalVerificationType;
  providerName: string;
  label: string;
  searchUrl: string;
  notes: string;
};

export const verificationLinks: VerificationLink[] = [
  {
    category: "maryland_board_of_nursing",
    verificationType: "maryland_board_of_nursing",
    providerName: "Maryland Board of Nursing",
    label: "Maryland Board of Nursing license lookup",
    searchUrl: "https://mbon.maryland.gov/",
    notes: "Provider-ready link. HR must manually record the active/current result."
  },
  {
    category: "nursys",
    verificationType: "nursys",
    providerName: "Nursys",
    label: "Nursys license verification",
    searchUrl: "https://www.nursys.com/",
    notes: "Provider-ready link. No private credentials are stored."
  },
  {
    category: "maryland_case_search",
    verificationType: "maryland_case_search",
    providerName: "Maryland Judiciary Case Search",
    label: "Maryland Case Search",
    searchUrl: "https://casesearch.courts.state.md.us/",
    notes: "Manual case search result must be recorded by HR."
  },
  {
    category: "oig_exclusion",
    verificationType: "oig",
    providerName: "OIG LEIE",
    label: "OIG exclusions search",
    searchUrl: "https://exclusions.oig.hhs.gov/",
    notes: "Manual OIG exclusion result must be recorded by HR."
  },
  {
    category: "background_check_cgis",
    verificationType: "cgis",
    providerName: "CGIS Background Check",
    label: "CGIS/background check receipt",
    searchUrl: "",
    notes: "Record agency, MA provider number, tracking number, date sent or verified, and receipt evidence."
  },
  {
    category: "liability_insurance_nso",
    verificationType: "nso",
    providerName: "NSO Liability Insurance",
    label: "NSO liability insurance verification",
    searchUrl: "https://www.nso.com/",
    notes: "Provider-ready link for manual evidence capture."
  },
  {
    category: "cpr",
    verificationType: "cpr",
    providerName: "CPR Certification Provider",
    label: "CPR verification",
    searchUrl: "",
    notes: "Use the certificate provider if available and record the manual result."
  }
];

export function getVerificationLink(category: VerificationCategory) {
  return verificationLinks.find((link) => link.category === category) ?? null;
}
