// Field shape for intake step "w9" — IRS Form W-9 page 1 (Request for
// Taxpayer Identification Number and Certification).

export const W9_TAX_CLASSIFICATIONS = [
  "Individual / sole proprietor",
  "C Corporation",
  "S Corporation",
  "Partnership",
  "Trust / estate",
  "Limited liability company",
  "Other"
] as const;
export type W9TaxClassification = (typeof W9_TAX_CLASSIFICATIONS)[number];

export const W9_LLC_TAX_CLASSIFICATIONS = ["C", "S", "P"] as const;
export type W9LlcTaxClassification = (typeof W9_LLC_TAX_CLASSIFICATIONS)[number];

export const W9_CERTIFICATION =
  "Under penalties of perjury, I certify that: 1) The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); 2) I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; 3) I am a U.S. citizen or other U.S. person; and 4) The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.";

export type W9Data = {
  // Line 1: Name
  fullName: string;
  // Line 2: Business name / disregarded entity (if different)
  businessName: string;
  // Line 3: Federal tax classification
  taxClassification: W9TaxClassification | "";
  llcTaxClassification: W9LlcTaxClassification | "";
  otherClassificationDescription: string;
  // Line 4: Exemptions
  exemptPayeeCode: string;
  fatcaExemptionCode: string;
  // Lines 5–6: Address
  addressStreet: string;
  addressCityStateZip: string;
  // Line 7: Requester's name and address (optional)
  requesterNameAddress: string;
  // Account number (optional)
  accountNumbers: string;
  // Part I: TIN
  tinType: "ssn" | "ein" | "";
  ssn: string; // 9 digits, masked-display in UI
  ein: string;
  // Backup withholding strikethrough (item 2)
  notSubjectToBackupWithholding: boolean;
  // Certification + signature
  certified: boolean;
  signatureName: string;
  signatureDate: string;
};

export function emptyW9Data(): W9Data {
  return {
    fullName: "",
    businessName: "",
    taxClassification: "",
    llcTaxClassification: "",
    otherClassificationDescription: "",
    exemptPayeeCode: "",
    fatcaExemptionCode: "",
    addressStreet: "",
    addressCityStateZip: "",
    requesterNameAddress: "Quality One Care Home Health, Inc.\n9221 Colesville Road\nSilver Spring, MD 20910",
    accountNumbers: "",
    tinType: "",
    ssn: "",
    ein: "",
    notSubjectToBackupWithholding: false,
    certified: false,
    signatureName: "",
    signatureDate: ""
  };
}

export function mergeW9Data(stored: unknown): W9Data {
  const empty = emptyW9Data();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: W9Data = { ...empty };
  for (const k of Object.keys(empty) as Array<keyof W9Data>) {
    if (obj[k as string] !== undefined && obj[k as string] !== null) {
      (merged as Record<string, unknown>)[k] = obj[k as string] as never;
    }
  }
  return merged;
}

function isValidSsn(value: string) {
  return /^\d{9}$/.test(value.replace(/\D/g, ""));
}

function isValidEin(value: string) {
  return /^\d{9}$/.test(value.replace(/\D/g, ""));
}

export function validateW9ForCompletion(data: W9Data): string[] {
  const errors: string[] = [];
  if (!data.fullName.trim()) errors.push("Line 1: Name is required.");
  if (!data.taxClassification) errors.push("Line 3: Choose a federal tax classification.");
  if (data.taxClassification === "Limited liability company" && !data.llcTaxClassification) {
    errors.push("Line 3: For an LLC, choose C / S / P tax classification.");
  }
  if (data.taxClassification === "Other" && !data.otherClassificationDescription.trim()) {
    errors.push("Line 3: Describe the 'Other' classification.");
  }
  if (!data.addressStreet.trim()) errors.push("Line 5: Address (street) is required.");
  if (!data.addressCityStateZip.trim()) errors.push("Line 6: City, state, ZIP is required.");
  if (!data.tinType) errors.push("Part I: Select SSN or EIN as the TIN type.");
  if (data.tinType === "ssn" && !isValidSsn(data.ssn)) errors.push("Part I: Enter a valid 9-digit SSN.");
  if (data.tinType === "ein" && !isValidEin(data.ein)) errors.push("Part I: Enter a valid 9-digit EIN.");
  if (!data.certified) errors.push("Sign Part II: certify the four statements under penalty of perjury.");
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}

export function maskSsnForDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 5) return digits;
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}
