import { prisma } from "@/lib/prisma";

export type StaleItem = {
  id: string;
  title: string;
  category: string;
  status: string;
  daysPending: number;
  updatedAt: Date;
};

export type StalePendingAnalysis = {
  staleItems: StaleItem[];
  hasStaleItems: boolean;
  oldestDays: number;
};

const STALE_THRESHOLD_DAYS = 7;

export async function findStalePendingItems(applicationId: string): Promise<StalePendingAnalysis> {
  const checklist = await prisma.finalVerificationChecklist.findUnique({
    where: { applicationId },
    include: {
      items: {
        where: {
          status: { in: ["pending", "pending_external_check", "needs_followup", "not_started"] }
        }
      }
    }
  });

  if (!checklist) return { staleItems: [], hasStaleItems: false, oldestDays: 0 };

  const now = new Date();
  const staleItems: StaleItem[] = [];

  for (const item of checklist.items) {
    const referenceDate = item.updatedAt;
    const daysPending = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysPending >= STALE_THRESHOLD_DAYS) {
      staleItems.push({
        id: item.id,
        title: item.title,
        category: item.category,
        status: item.status,
        daysPending,
        updatedAt: referenceDate
      });
    }
  }

  staleItems.sort((a, b) => b.daysPending - a.daysPending);

  return {
    staleItems,
    hasStaleItems: staleItems.length > 0,
    oldestDays: staleItems[0]?.daysPending ?? 0
  };
}

export async function findAllStalePendingAcrossApplications(): Promise<Array<StaleItem & { applicationId: string; applicantName: string }>> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  const items = await prisma.verificationChecklistItem.findMany({
    where: {
      status: { in: ["pending", "pending_external_check", "needs_followup", "not_started"] },
      updatedAt: { lt: cutoff }
    },
    include: {
      checklist: {
        include: {
          application: {
            include: { applicantProfile: { include: { user: { select: { name: true, email: true } } } } }
          }
        }
      }
    },
    orderBy: { updatedAt: "asc" }
  });

  return items.map((item) => {
    const daysPending = Math.floor((now.getTime() - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    const user = item.checklist.application.applicantProfile.user;
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      status: item.status,
      daysPending,
      updatedAt: item.updatedAt,
      applicationId: item.checklist.applicationId,
      applicantName: user.name ?? user.email
    };
  });
}
