"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Gap = {
  afterEmployer: string;
  beforeEmployer: string;
  gapStartDate: string;
  gapEndDate: string;
  gapMonths: number;
};

type GapAnalysis = {
  gaps: Gap[];
  hasSignificantGaps: boolean;
  totalGapMonths: number;
};

export function EmploymentGapAlert({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<GapAnalysis | null>(null);

  useEffect(() => {
    fetch(`/api/hr/verification/employment-gaps/${applicationId}`, { headers: getCsrfHeaders() })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [applicationId]);

  if (!data || !data.hasSignificantGaps) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-700 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-amber-900">Employment gaps detected</p>
          <p className="mt-1 text-sm text-amber-800">
            {data.gaps.length} gap{data.gaps.length > 1 ? "s" : ""} totaling {data.totalGapMonths} month{data.totalGapMonths !== 1 ? "s" : ""} found in employment history. Healthcare regulators may require explanation.
          </p>
          <div className="mt-3 grid gap-2">
            {data.gaps.map((gap, i) => (
              <div key={i} className="rounded-md border border-amber-200 bg-white p-3 text-sm">
                <p className="font-medium text-slate-900">
                  {gap.gapMonths} month gap
                </p>
                <p className="text-slate-600">
                  After <span className="font-medium">{gap.afterEmployer}</span> (ended {new Date(gap.gapStartDate).toLocaleDateString()})
                </p>
                <p className="text-slate-600">
                  Before <span className="font-medium">{gap.beforeEmployer}</span> (started {new Date(gap.gapEndDate).toLocaleDateString()})
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
