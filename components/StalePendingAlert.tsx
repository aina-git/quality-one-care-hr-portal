"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { getCsrfHeaders } from "@/lib/csrf-client";

type StaleItem = {
  id: string;
  title: string;
  category: string;
  status: string;
  daysPending: number;
};

type StalePendingAnalysis = {
  staleItems: StaleItem[];
  hasStaleItems: boolean;
  oldestDays: number;
};

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function urgencyTone(days: number) {
  if (days >= 14) return "border-red-300 bg-red-50 text-red-900";
  if (days >= 10) return "border-orange-300 bg-orange-50 text-orange-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export function StalePendingAlert({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<StalePendingAnalysis | null>(null);

  useEffect(() => {
    fetch(`/api/hr/verification/stale-items/${applicationId}`, { headers: getCsrfHeaders() })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [applicationId]);

  if (!data || !data.hasStaleItems) return null;

  return (
    <div className="rounded-xl border border-orange-300 bg-orange-50/60 p-4">
      <div className="flex items-start gap-3">
        <Clock size={18} className="text-orange-700 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-orange-900">
            {data.staleItems.length} stale verification item{data.staleItems.length > 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-sm text-orange-800">
            These items have been pending for 7+ days with no update. The oldest has been waiting {data.oldestDays} days.
          </p>
          <div className="mt-3 grid gap-2">
            {data.staleItems.map((item) => (
              <div key={item.id} className={`flex items-center justify-between rounded-md border p-2.5 text-sm ${urgencyTone(item.daysPending)}`}>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs opacity-80">{statusLabel(item.status)}</p>
                </div>
                <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold">{item.daysPending}d</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
