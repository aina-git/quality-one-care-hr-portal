import { prisma } from "@/lib/prisma";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  return [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
}

export async function exportApplicationsCsv(applicationIds?: string[]) {
  const applications = await prisma.application.findMany({
    where: applicationIds?.length ? { id: { in: applicationIds } } : { status: { not: "draft" } },
    include: {
      applicantProfile: {
        include: {
          user: true
        }
      },
      aiReviewReports: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      decisions: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      licenses: true
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }]
  });

  return toCsv(
    [
      "Application ID",
      "Applicant Name",
      "Applicant Email",
      "Status",
      "Submitted At",
      "Risk Level",
      "Recommendation",
      "Latest Decision",
      "License Status"
    ],
    applications.map((application) => {
      const report = application.aiReviewReports[0];
      const decision = application.decisions[0];
      const now = Date.now();
      const licenseStatus = !application.licenses.length
        ? "none"
        : application.licenses.some((license) => license.expiresAt && license.expiresAt.getTime() < now)
          ? "expired"
          : application.licenses.some((license) => license.expiresAt && license.expiresAt.getTime() <= now + 30 * 24 * 60 * 60 * 1000)
            ? "expiring_soon"
            : "active";

      return [
        application.id,
        application.applicantProfile.user.name ?? "",
        application.applicantProfile.user.email,
        application.status,
        application.submittedAt?.toISOString() ?? "",
        report?.overallRiskLevel ?? "",
        report?.recommendation ?? "",
        decision?.action ?? "",
        licenseStatus
      ];
    })
  );
}

export async function exportOnboardingStatusCsv() {
  const checklists = await prisma.onboardingChecklist.findMany({
    include: {
      application: {
        include: {
          applicantProfile: {
            include: {
              user: true
            }
          }
        }
      },
      items: true
    },
    orderBy: { createdAt: "desc" }
  });

  return toCsv(
    ["Application ID", "Applicant Email", "Checklist Status", "Completed Items", "Total Items"],
    checklists.map((checklist) => [
      checklist.applicationId,
      checklist.application.applicantProfile.user.email,
      checklist.status,
      checklist.items.filter((item) => item.status !== "pending").length,
      checklist.items.length
    ])
  );
}

export async function exportLicenseStatusCsv() {
  const licenses = await prisma.license.findMany({
    where: { applicationId: { not: null } },
    include: {
      application: {
        include: {
          applicantProfile: {
            include: {
              user: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return toCsv(
    ["Application ID", "Applicant Email", "License Type", "License Number", "Expiration Date", "Status"],
    licenses.map((license) => {
      const expiresAt = license.expiresAt?.getTime() ?? null;
      const now = Date.now();
      const status = !expiresAt ? "missing_expiration" : expiresAt < now ? "expired" : expiresAt <= now + 30 * 24 * 60 * 60 * 1000 ? "expiring_soon" : "active";
      return [
        license.applicationId ?? "",
        license.application?.applicantProfile.user.email ?? "",
        license.type,
        license.licenseNumber ?? "",
        license.expiresAt?.toISOString() ?? "",
        status
      ];
    })
  );
}

export async function exportAuditLogsCsv() {
  const logs = await prisma.auditLog.findMany({
    include: {
      user: {
        select: {
          email: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 5000
  });

  return toCsv(
    ["Created At", "User", "Action", "Entity Type", "Entity ID", "Request Path", "IP Address"],
    logs.map((log) => [
      log.createdAt.toISOString(),
      log.user?.email ?? "",
      log.action,
      log.entityType,
      log.entityId ?? "",
      log.requestPath ?? "",
      log.ipAddress ?? ""
    ])
  );
}
