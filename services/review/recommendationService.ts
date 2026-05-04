import type { FindingSeverity, ReviewRecommendation, RiskLevel } from "@prisma/client";
import type { DraftFinding } from "@/services/review/discrepancyService";

export function chooseRiskAndRecommendation({
  findings,
  pediatricStrength,
  licenseExpired,
  incomplete
}: {
  findings: DraftFinding[];
  pediatricStrength: string;
  licenseExpired: boolean;
  incomplete: boolean;
}): { risk: RiskLevel; recommendation: ReviewRecommendation; actionItems: string[] } {
  const actionItems: string[] = [];
  const critical = findings.filter((finding) => finding.severity === "critical").length;
  const concerns = findings.filter((finding) => finding.severity === "concern").length;
  const severityCounts = findings.reduce<Record<FindingSeverity, number>>(
    (acc, finding) => ({ ...acc, [finding.severity]: acc[finding.severity] + 1 }),
    { info: 0, warning: 0, concern: 0, critical: 0 }
  );

  if (incomplete) {
    actionItems.push("Confirm all required review inputs are available before relying on this report.");
    return { risk: "incomplete_review", recommendation: "hold_for_review", actionItems };
  }

  if (licenseExpired || critical > 0 || pediatricStrength === "none") {
    if (licenseExpired) actionItems.push("Review license expiration before moving forward.");
    if (pediatricStrength === "none") actionItems.push("Request clarification about pediatric or home-health care experience.");
    return { risk: "high", recommendation: "not_recommended_at_this_stage", actionItems };
  }

  if (concerns >= 3) {
    actionItems.push("Review multiple concerns with the applicant before interview scheduling.");
    return { risk: "high", recommendation: "hold_for_review", actionItems };
  }

  if (concerns > 0 || severityCounts.warning > 1 || pediatricStrength === "weak") {
    actionItems.push("Ask applicant to clarify flagged discrepancies or incomplete supporting evidence.");
    return { risk: "moderate", recommendation: "request_clarification", actionItems };
  }

  actionItems.push("HR may proceed with normal interview screening if appropriate.");
  return { risk: "low", recommendation: "proceed_to_interview", actionItems };
}
