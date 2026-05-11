import { prisma } from "@/lib/prisma";

export type EmploymentGap = {
  afterEmployer: string;
  beforeEmployer: string;
  gapStartDate: Date;
  gapEndDate: Date;
  gapMonths: number;
};

export type GapAnalysis = {
  gaps: EmploymentGap[];
  hasSignificantGaps: boolean;
  totalGapMonths: number;
};

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export async function analyzeEmploymentGaps(applicationId: string): Promise<GapAnalysis> {
  const records = await prisma.employmentHistory.findMany({
    where: { applicationId },
    orderBy: { startDate: "asc" }
  });

  const intakeStep = await prisma.intakeStep.findFirst({
    where: { applicationId, stepKey: "application_form" }
  });
  const formData = (intakeStep?.data ?? {}) as Record<string, unknown>;

  const entries: Array<{ name: string; start: Date; end: Date | null }> = [];

  for (const rec of records) {
    if (rec.startDate) {
      entries.push({ name: rec.employerName || "Unknown employer", start: rec.startDate, end: rec.endDate ?? null });
    }
  }

  for (const slot of ["employer1", "employer2", "employer3"]) {
    const emp = formData[slot] as Record<string, unknown> | undefined;
    if (!emp?.from) continue;
    const start = new Date(emp.from as string);
    if (Number.isNaN(start.getTime())) continue;
    const end = emp.to ? new Date(emp.to as string) : null;
    if (end && Number.isNaN(end.getTime())) continue;
    const name = (emp.employerName as string) || "Employer";
    const alreadyTracked = entries.some((e) =>
      e.name === name && Math.abs(e.start.getTime() - start.getTime()) < 86400000 * 30
    );
    if (!alreadyTracked) {
      entries.push({ name, start, end: end ?? null });
    }
  }

  entries.sort((a, b) => a.start.getTime() - b.start.getTime());

  const gaps: EmploymentGap[] = [];
  const GAP_THRESHOLD_MONTHS = 3;

  for (let i = 0; i < entries.length - 1; i++) {
    const current = entries[i];
    const next = entries[i + 1];
    if (!current.end) continue;
    const gapMonths = monthsBetween(current.end, next.start);
    if (gapMonths >= GAP_THRESHOLD_MONTHS) {
      gaps.push({
        afterEmployer: current.name,
        beforeEmployer: next.name,
        gapStartDate: current.end,
        gapEndDate: next.start,
        gapMonths
      });
    }
  }

  const totalGapMonths = gaps.reduce((sum, g) => sum + g.gapMonths, 0);

  return {
    gaps,
    hasSignificantGaps: gaps.length > 0,
    totalGapMonths
  };
}
