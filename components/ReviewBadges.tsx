import type { RiskLevel, ReviewRecommendation } from "@prisma/client";

export function RiskBadge({ risk }: { risk?: RiskLevel | null }) {
  const label = {
    low: "Low Risk",
    moderate: "Moderate Risk",
    high: "High Risk",
    incomplete_review: "Incomplete Review"
  }[risk ?? "incomplete_review"];
  const color = risk === "low" ? "bg-green-50 text-green-700 border-green-200" : risk === "moderate" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-red-50 text-red-700 border-red-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${color}`}>{label}</span>;
}

export function RecommendationBadge({ recommendation }: { recommendation?: ReviewRecommendation | null }) {
  const label = {
    proceed_to_interview: "Proceed to Interview",
    request_clarification: "Request Clarification",
    hold_for_review: "Hold for Review",
    not_recommended_at_this_stage: "Not Recommended at This Stage"
  }[recommendation ?? "hold_for_review"];
  return <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">{label}</span>;
}
