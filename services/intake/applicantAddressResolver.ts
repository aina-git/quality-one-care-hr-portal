import { prisma } from "@/lib/prisma";

/**
 * The "best known" mailing address for the applicant, used to pre-fill
 * the same fields across W-9, W-4, MW507, etc. so they don't retype.
 *
 * Resolution order:
 *   1. application_form intake step (mailingAddress they typed)
 *   2. ApplicantProfile (address/city/state/zip from PersonalInfoSection)
 *   3. ExtractedField from a detected ID/DL/passport document
 *
 * Returns null when nothing is on file yet.
 */

export type KnownAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
  fullName: string;
  source: "application_form" | "profile" | "extracted_id" | "user";
};

/**
 * Best-effort parse of a single combined "Street, City, State ZIP" string
 * into structured pieces. We accept a lot of common shapes since applicants
 * type whatever — no fancy NLP, just rules.
 */
function parseCombinedAddress(combined: string): { street: string; city: string; state: string; zip: string } {
  const out = { street: "", city: "", state: "", zip: "" };
  const value = (combined ?? "").trim();
  if (!value) return out;

  // Try comma-split first
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    out.street = parts[0];
    out.city = parts[1];
    // Last segment looks like "MD 20910" or "MD 20910-1234"
    const last = parts[2];
    const m = last.match(/^([A-Za-z\.\s]+?)\s+(\d{5}(-\d{4})?)\s*$/);
    if (m) {
      out.state = m[1].trim();
      out.zip = m[2];
    } else {
      // Just a state, no zip — or just a zip
      if (/^\d{5}/.test(last)) {
        out.zip = last.match(/\d{5}(-\d{4})?/)?.[0] ?? "";
      } else {
        out.state = last;
      }
    }
    if (parts[3]) out.zip = parts[3].match(/\d{5}(-\d{4})?/)?.[0] ?? out.zip;
    return out;
  }
  if (parts.length === 2) {
    out.street = parts[0];
    const m = parts[1].match(/^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(-\d{4})?)\s*$/);
    if (m) {
      out.city = m[1].trim();
      out.state = m[2];
      out.zip = m[3];
    } else {
      out.city = parts[1];
    }
    return out;
  }
  out.street = value;
  return out;
}

export async function getApplicantKnownAddress(applicationId: string): Promise<KnownAddress | null> {
  // 1. application_form intake step
  try {
    const appFormStep = await prisma.intakeStep.findUnique({
      where: { applicationId_stepKey: { applicationId, stepKey: "application_form" } }
    });
    if (appFormStep?.data && typeof appFormStep.data === "object") {
      const d = appFormStep.data as Record<string, unknown>;
      const combined = String(d.mailingAddress ?? "").trim();
      const fullName = String(d.fullLegalName ?? "").trim();
      if (combined) {
        const parsed = parseCombinedAddress(combined);
        return {
          street: parsed.street,
          city: parsed.city,
          state: parsed.state,
          zip: parsed.zip,
          fullName,
          source: "application_form"
        };
      }
    }
  } catch { /* fall through */ }

  // 2. ApplicantProfile
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicantProfile: { include: { user: true } } }
  }).catch(() => null);
  if (application) {
    const p = application.applicantProfile;
    const street = p.address ?? "";
    const city = p.city ?? "";
    const state = p.state ?? "";
    const zip = p.zip ?? "";
    if (street || city || state || zip) {
      return {
        street,
        city,
        state,
        zip,
        fullName: p.user.name ?? "",
        source: "profile"
      };
    }
  }

  // 3. ExtractedField from an ID/DL document
  try {
    const idDocs = await prisma.uploadedDocument.findMany({
      where: {
        applicationId,
        OR: [
          { detectedDocumentType: { contains: "license", mode: "insensitive" } },
          { detectedDocumentType: { contains: "id", mode: "insensitive" } },
          { documentType: { contains: "ID", mode: "insensitive" } },
          { documentType: { contains: "license", mode: "insensitive" } },
          { documentType: { contains: "passport", mode: "insensitive" } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true }
    });
    if (idDocs.length > 0) {
      const fields = await prisma.extractedField.findMany({
        where: {
          applicationId,
          sourceDocumentId: { in: idDocs.map((d) => d.id) },
          fieldKey: { in: ["address", "name"] }
        },
        orderBy: { createdAt: "desc" }
      });
      const addressField = fields.find((f) => f.fieldKey === "address");
      const nameField = fields.find((f) => f.fieldKey === "name");
      if (addressField) {
        const value = (addressField.applicantCorrectedValue ?? addressField.extractedValue ?? "").trim();
        if (value) {
          const parsed = parseCombinedAddress(value);
          return {
            street: parsed.street,
            city: parsed.city,
            state: parsed.state,
            zip: parsed.zip,
            fullName: (nameField?.applicantCorrectedValue ?? nameField?.extractedValue ?? "").trim() || (application?.applicantProfile.user.name ?? ""),
            source: "extracted_id"
          };
        }
      }
    }
  } catch { /* fall through */ }

  // 4. Bare user fallback (just name, no address)
  if (application?.applicantProfile.user.name) {
    return {
      street: "",
      city: "",
      state: "",
      zip: "",
      fullName: application.applicantProfile.user.name,
      source: "user"
    };
  }

  return null;
}

export function combinedCityStateZip(addr: { city: string; state: string; zip: string }): string {
  const stateZip = [addr.state, addr.zip].filter(Boolean).join(" ");
  return [addr.city, stateZip].filter(Boolean).join(", ");
}
