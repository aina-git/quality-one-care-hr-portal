import type { ApplicationSnapshot } from "@/services/review/applicationSnapshotService";
import { combinedExtractionText } from "@/services/review/applicationSnapshotService";

const pediatricKeywords = [
  "pediatric", "child", "children", "youth", "infant", "adolescent", "school care",
  "developmental disability", "autism", "seizure", "trach", "g-tube", "home health",
  "skilled nursing", "behavioral support", "special needs"
];

export function reviewPediatricExperience(snapshot: ApplicationSnapshot) {
  const sources: string[] = [];
  const concerns: string[] = [];
  const profileText = snapshot.applicantProfile.pediatricExperience ?? "";
  const employmentText = snapshot.employmentHistory.map((job) => `${job.employerName} ${job.roleTitle} ${job.duties ?? ""}`).join(" ");
  const documentText = combinedExtractionText(snapshot, ["resume", "application_form"]);
  const allText = `${profileText} ${employmentText} ${documentText}`.toLowerCase();
  const matched = pediatricKeywords.filter((keyword) => allText.includes(keyword));

  if (snapshot.employmentHistory.some((job) => job.pediatricCare || /pediatric|child|children|infant|home health/i.test(job.duties ?? ""))) {
    sources.push("Employment history includes pediatric or child/home-health duties.");
  }
  if (/yes|pediatric|child|children|infant|home health/i.test(profileText)) {
    sources.push("Applicant profile includes pediatric care experience.");
  }
  if (matched.length > 0) {
    sources.push(`Document text includes: ${matched.slice(0, 6).join(", ")}.`);
  }
  if (sources.length === 0) concerns.push("No pediatric care evidence found in confirmed application data or uploaded document text.");
  if (/yes|pediatric/i.test(profileText) && sources.length < 2) concerns.push("Pediatric experience is claimed but supporting detail is limited.");

  const estimatedYears = snapshot.employmentHistory.reduce((years, job) => {
    if (!job.startDate || !job.endDate) return years;
    const delta = job.endDate.getTime() - job.startDate.getTime();
    return years + Math.max(0, delta / (1000 * 60 * 60 * 24 * 365));
  }, 0);

  const strengthLevel = sources.length >= 3 ? "strong" : sources.length === 2 ? "moderate" : sources.length === 1 ? "weak" : "none";

  return {
    hasEvidence: sources.length > 0,
    evidenceSources: sources,
    estimatedYears: Math.round(estimatedYears * 10) / 10,
    strengthLevel,
    concerns,
    summary: sources.length > 0 ? `Pediatric relevance appears ${strengthLevel}.` : "No pediatric relevance evidence was found."
  };
}
