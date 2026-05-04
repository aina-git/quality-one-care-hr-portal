import type { ApplicationSnapshot } from "@/services/review/applicationSnapshotService";
import { combinedExtractionText } from "@/services/review/applicationSnapshotService";

export function reviewEmployment(snapshot: ApplicationSnapshot) {
  const dateIssues: string[] = [];
  const concerns: string[] = [];
  const resumeText = combinedExtractionText(snapshot, ["resume", "application_form"]);
  const pediatricRelevantEmployers = snapshot.employmentHistory
    .filter((job) => job.pediatricCare || /pediatric|child|children|home health|skilled nursing/i.test(job.duties ?? ""))
    .map((job) => job.employerName);

  if (snapshot.employmentHistory.length === 0) concerns.push("No employment history is confirmed.");
  for (const job of snapshot.employmentHistory) {
    if (!job.startDate || !job.endDate) dateIssues.push(`${job.employerName} has incomplete employment dates.`);
    if (job.startDate && job.endDate && job.endDate < job.startDate) dateIssues.push(`${job.employerName} has an end date before start date.`);
    if (resumeText && !resumeText.includes(job.employerName.toLowerCase())) concerns.push(`${job.employerName} was not found in resume/application extracted text.`);
  }

  const sorted = [...snapshot.employmentHistory].filter((job) => job.startDate && job.endDate).sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());
  const possibleGaps: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1].endDate!;
    const current = sorted[i].startDate!;
    const gapDays = (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24);
    if (gapDays > 180) possibleGaps.push(`Possible gap of ${Math.round(gapDays)} days before ${sorted[i].employerName}.`);
  }

  return {
    employerCount: snapshot.employmentHistory.length,
    dateIssues,
    pediatricRelevantEmployers,
    possibleGaps,
    concerns,
    summary: snapshot.employmentHistory.length > 0 ? `${snapshot.employmentHistory.length} employer record(s) reviewed.` : "No employer records available for review."
  };
}
