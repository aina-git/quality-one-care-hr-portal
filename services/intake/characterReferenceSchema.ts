// Field shape for intake step "character_reference" — applicant identifies
// their professional references and signs the FCRA authorization that lets
// each reference disclose information to QOC. Reference responses
// themselves are collected on the printed/PDF form by each reference and
// uploaded back through the Upload Documents flow.

export const FCRA_AUTHORIZATION_STATEMENT =
  "Pursuant to the Fair Credit Reporting Act (15 U.S.C. §1681 et seq.) and applicable state law, I authorize the references listed below to disclose information regarding my professional performance, character, and suitability for clinical positions involving care of children with special needs and/or vulnerable adults to Quality One Care Home Health, Inc. for use in employment evaluation. I release each reference and Quality One Care from liability arising from disclosures made in good faith.";

export type ReferenceContact = {
  fullName: string;
  titlePosition: string;
  organization: string;
  phone: string;
  email: string;
  yearsKnown: string;
  capacityKnown: string;
  bestTimeToContact: string;
};

export type CharacterReferenceData = {
  reference1: ReferenceContact;
  reference2: ReferenceContact;
  reference3: ReferenceContact;
  fcraAuthorized: boolean;
  signatureName: string;
  signatureDate: string;
};

export function emptyReferenceContact(): ReferenceContact {
  return {
    fullName: "",
    titlePosition: "",
    organization: "",
    phone: "",
    email: "",
    yearsKnown: "",
    capacityKnown: "",
    bestTimeToContact: ""
  };
}

export function emptyCharacterReferenceData(): CharacterReferenceData {
  return {
    reference1: emptyReferenceContact(),
    reference2: emptyReferenceContact(),
    reference3: emptyReferenceContact(),
    fcraAuthorized: false,
    signatureName: "",
    signatureDate: ""
  };
}

export function mergeCharacterReferenceData(stored: unknown): CharacterReferenceData {
  const empty = emptyCharacterReferenceData();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: CharacterReferenceData = { ...empty };
  for (const k of Object.keys(empty) as Array<keyof CharacterReferenceData>) {
    const value = obj[k as string];
    if (value === undefined || value === null) continue;
    if (k === "reference1" || k === "reference2" || k === "reference3") {
      const base = emptyReferenceContact();
      const ref = value as Partial<ReferenceContact>;
      for (const rk of Object.keys(base) as Array<keyof ReferenceContact>) {
        if (ref[rk] !== undefined && ref[rk] !== null) base[rk] = String(ref[rk]);
      }
      (merged as Record<string, unknown>)[k] = base;
      continue;
    }
    (merged as Record<string, unknown>)[k] = value;
  }
  return merged;
}

function referenceIsFilled(ref: ReferenceContact) {
  return ref.fullName.trim() && (ref.phone.trim() || ref.email.trim());
}

export function validateCharacterReferenceForCompletion(data: CharacterReferenceData): string[] {
  const errors: string[] = [];
  const filledCount = [data.reference1, data.reference2, data.reference3].filter(referenceIsFilled).length;
  if (filledCount < 2) errors.push("Provide at least two professional references with name and a phone or email.");
  if (!data.fcraAuthorized) errors.push("Sign the FCRA authorization to allow your references to be contacted.");
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}
