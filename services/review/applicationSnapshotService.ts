import { prisma } from "@/lib/prisma";

export type ApplicationSnapshot = NonNullable<Awaited<ReturnType<typeof getApplicationSnapshot>>>;

export async function getApplicationSnapshot(applicationId: string) {
  return prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      applicantProfile: { include: { user: true } },
      employmentHistory: true,
      licenses: true,
      certifications: true,
      references: true,
      documents: { include: { extractions: true } },
      extractions: true,
      extractedFields: { include: { sourceDocument: true } },
      validationIssues: true,
      aiReviewReports: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { findings: true }
      }
    }
  });
}

export function combinedExtractionText(snapshot: ApplicationSnapshot, types?: string[]) {
  return snapshot.extractions
    .filter((extraction) => !types || types.includes(extraction.documentTypeDetected))
    .map((extraction) => extraction.rawText)
    .join("\n")
    .toLowerCase();
}
