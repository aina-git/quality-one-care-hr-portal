import { prisma } from "@/lib/prisma";

export type DuplicateMatch = {
  userId: string;
  name: string | null;
  email: string;
  phone: string | null;
  matchReasons: string[];
  previousApplications: Array<{
    id: string;
    status: string;
    desiredRole: string | null;
    submittedAt: Date | null;
  }>;
};

export type DuplicateAnalysis = {
  matches: DuplicateMatch[];
  hasDuplicates: boolean;
};

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function normalizePhone(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "").slice(-10);
}

export async function checkForDuplicates(applicationId: string): Promise<DuplicateAnalysis> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicantProfile: { include: { user: true } } }
  });
  if (!application) return { matches: [], hasDuplicates: false };

  const profile = application.applicantProfile;
  const currentUserId = profile.userId;
  const currentName = normalize(profile.user.name);
  const currentEmail = normalize(profile.user.email);
  const currentPhone = normalizePhone(profile.phone);

  const intakeStep = await prisma.intakeStep.findFirst({
    where: { applicationId, stepKey: "application_form" }
  });
  const formData = (intakeStep?.data ?? {}) as Record<string, unknown>;
  const formSsn = normalize(formData.ssn as string | undefined);

  const allProfiles = await prisma.applicantProfile.findMany({
    where: { userId: { not: currentUserId } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      applications: {
        select: { id: true, status: true, desiredRole: true, submittedAt: true, applicationSubmittedAt: true },
        orderBy: { createdAt: "desc" },
        take: 3
      }
    }
  });

  const matches: DuplicateMatch[] = [];

  for (const other of allProfiles) {
    const reasons: string[] = [];

    if (currentName && normalize(other.user.name) === currentName) {
      reasons.push("Same name");
    }

    if (currentEmail && normalize(other.user.email) === currentEmail) {
      reasons.push("Same email");
    }

    if (currentPhone && currentPhone.length >= 10 && normalizePhone(other.phone) === currentPhone) {
      reasons.push("Same phone number");
    }

    if (formSsn && formSsn.length >= 4) {
      const otherStep = await prisma.intakeStep.findFirst({
        where: {
          stepKey: "application_form",
          application: { applicantProfileId: other.id }
        }
      });
      const otherData = (otherStep?.data ?? {}) as Record<string, unknown>;
      const otherSsn = normalize(otherData.ssn as string | undefined);
      if (otherSsn && otherSsn.length >= 4 && otherSsn.slice(-4) === formSsn.slice(-4)) {
        reasons.push("Same SSN (last 4 digits)");
      }
    }

    if (reasons.length > 0) {
      matches.push({
        userId: other.user.id,
        name: other.user.name,
        email: other.user.email,
        phone: other.phone,
        matchReasons: reasons,
        previousApplications: other.applications.map((a) => ({
          id: a.id,
          status: a.status,
          desiredRole: a.desiredRole,
          submittedAt: a.submittedAt ?? a.applicationSubmittedAt
        }))
      });
    }
  }

  matches.sort((a, b) => b.matchReasons.length - a.matchReasons.length);

  return { matches, hasDuplicates: matches.length > 0 };
}
