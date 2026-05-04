/**
 * Credential expiration auto-monitor.
 *
 * Extends the existing license-expiration alerts to ALSO cover certifications
 * (CPR, training certs, BLS, etc.) and verification checklist items with
 * expiration dates.
 *
 * Produces SystemAlert records that surface in the HR dashboard's operational
 * alerts feed. Auto-resolves alerts when the credential is updated/replaced.
 */

import { prisma } from "@/lib/prisma";
import { createSystemAlert } from "@/services/alerts/systemAlertService";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

type Bucket = "expired" | "expiring_7_days" | "expiring_30_days" | null;

function bucketFor(expiresAt: Date, now: Date): Bucket {
  if (expiresAt < now) return "expired";
  if (expiresAt.getTime() <= now.getTime() + SEVEN_DAYS_MS) return "expiring_7_days";
  if (expiresAt.getTime() <= now.getTime() + THIRTY_DAYS_MS) return "expiring_30_days";
  return null;
}

function priorityFor(bucket: Bucket): "critical" | "high" | "normal" {
  if (bucket === "expired") return "critical";
  if (bucket === "expiring_7_days") return "high";
  return "normal";
}

export async function scanCredentialExpirations(): Promise<{
  certificationAlerts: number;
  verificationItemAlerts: number;
}> {
  const now = new Date();
  let certificationAlerts = 0;
  let verificationItemAlerts = 0;

  // Certifications attached to non-draft applications
  const certifications = await prisma.certification.findMany({
    where: {
      applicationId: { not: null },
      expiresAt: { not: null },
      application: { status: { not: "draft" } }
    },
    include: { application: { include: { applicantProfile: { include: { user: true } } } } }
  });

  for (const cert of certifications) {
    if (!cert.applicationId || !cert.expiresAt) continue;
    const bucket = bucketFor(cert.expiresAt, now);
    if (!bucket) continue;
    const applicantName = cert.application?.applicantProfile.user.name ?? cert.application?.applicantProfile.user.email ?? "applicant";
    await createSystemAlert({
      category: "credential_expiration",
      priority: priorityFor(bucket),
      title: `${cert.name} ${bucket === "expired" ? "EXPIRED" : "expires soon"}`,
      message: `${applicantName}'s ${cert.name}${cert.issuer ? ` (${cert.issuer})` : ""} ${bucket === "expired" ? "expired" : "expires"} on ${dateOnly(cert.expiresAt)}.`,
      route: `/hr/applications/${cert.applicationId}/verification`,
      applicationId: cert.applicationId,
      dedupeKey: `cert_expiration:${cert.id}:${bucket}`
    });
    certificationAlerts++;
  }

  // Verification checklist items with expiration dates (CPR, TB, NSO, etc.)
  const verificationItems = await prisma.verificationChecklistItem.findMany({
    where: {
      expirationDate: { not: null },
      status: { in: ["verified", "pending_external_check"] },
      checklist: { application: { status: { not: "draft" } } }
    },
    include: { checklist: { include: { application: { include: { applicantProfile: { include: { user: true } } } } } } }
  });

  for (const item of verificationItems) {
    if (!item.expirationDate) continue;
    const bucket = bucketFor(item.expirationDate, now);
    if (!bucket) continue;
    const application = item.checklist.application;
    const applicantName = application.applicantProfile.user.name ?? application.applicantProfile.user.email;

    await createSystemAlert({
      category: "credential_expiration",
      priority: priorityFor(bucket),
      title: `${item.title} ${bucket === "expired" ? "EXPIRED" : "expires soon"}`,
      message: `${applicantName}'s verification item "${item.title}" ${bucket === "expired" ? "expired" : "expires"} on ${dateOnly(item.expirationDate)}. ${item.notes ? `Notes: ${item.notes}` : ""}`.trim(),
      route: `/hr/applications/${application.id}/verification`,
      applicationId: application.id,
      dedupeKey: `verification_item_expiration:${item.id}:${bucket}`
    });

    // If expired, auto-flip the item status so it shows as a critical blocker
    if (bucket === "expired" && item.status !== "expired") {
      await prisma.verificationChecklistItem.update({
        where: { id: item.id },
        data: { status: "expired" }
      });
    }
    verificationItemAlerts++;
  }

  return { certificationAlerts, verificationItemAlerts };
}
