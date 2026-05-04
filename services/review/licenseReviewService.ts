import type { ApplicationSnapshot } from "@/services/review/applicationSnapshotService";
import { combinedExtractionText } from "@/services/review/applicationSnapshotService";

export function reviewLicenses(snapshot: ApplicationSnapshot) {
  const license = snapshot.licenses[0];
  const concerns: string[] = [];
  const docText = combinedExtractionText(snapshot, ["license"]);
  const licensedRole = /nurse|rn|lpn|cna|skilled/i.test(snapshot.desiredRole ?? "");

  if (!license && licensedRole) concerns.push("Licensed role indicated but no license record is confirmed.");
  if (license?.expiresAt && license.expiresAt < new Date()) concerns.push("License expiration date is in the past.");
  if (license?.licenseNumber && docText && !docText.includes(license.licenseNumber.toLowerCase())) {
    concerns.push("Confirmed license number was not found in license document text.");
  }

  return {
    licensePresent: Boolean(license),
    licenseType: license?.type ?? null,
    status: !license ? "missing" : license.expiresAt && license.expiresAt < new Date() ? "expired" : "present",
    expirationDate: license?.expiresAt?.toISOString() ?? null,
    expired: Boolean(license?.expiresAt && license.expiresAt < new Date()),
    concerns,
    summary: license ? `License record present for ${license.type}.` : "No confirmed license record is present."
  };
}
