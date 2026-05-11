"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { getCsrfHeaders } from "@/lib/csrf-client";

type DuplicateMatch = {
  userId: string;
  name: string | null;
  email: string;
  phone: string | null;
  matchReasons: string[];
  previousApplications: Array<{
    id: string;
    status: string;
    desiredRole: string | null;
    submittedAt: string | null;
  }>;
};

type DuplicateAnalysis = {
  matches: DuplicateMatch[];
  hasDuplicates: boolean;
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DuplicateApplicantAlert({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<DuplicateAnalysis | null>(null);

  useEffect(() => {
    fetch(`/api/hr/verification/duplicate-check/${applicationId}`, { headers: getCsrfHeaders() })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [applicationId]);

  if (!data || !data.hasDuplicates) return null;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <Users size={18} className="text-red-700 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-red-900">Potential duplicate applicant detected</p>
          <p className="mt-1 text-sm text-red-800">
            {data.matches.length} existing record{data.matches.length > 1 ? "s" : ""} match this applicant. Review before proceeding.
          </p>
          <div className="mt-3 grid gap-2">
            {data.matches.map((match) => (
              <div key={match.userId} className="rounded-md border border-red-200 bg-white p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{match.name ?? "Unnamed"}</p>
                    <p className="text-xs text-slate-600">{match.email}{match.phone ? ` / ${match.phone}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {match.matchReasons.map((reason) => (
                      <span key={reason} className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">{reason}</span>
                    ))}
                  </div>
                </div>
                {match.previousApplications.length > 0 && (
                  <div className="mt-2 border-t border-red-100 pt-2">
                    <p className="text-xs font-medium text-slate-700 mb-1">Previous applications:</p>
                    {match.previousApplications.map((app) => (
                      <p key={app.id} className="text-xs text-slate-600">
                        {app.desiredRole ?? "No role"} - <span className="font-medium">{statusLabel(app.status)}</span>
                        {app.submittedAt && ` (${new Date(app.submittedAt).toLocaleDateString()})`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
