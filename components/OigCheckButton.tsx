"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

type CheckResult = {
  matched: boolean;
  matchType: "none" | "exact_with_dob" | "name_only";
  matches: Array<{
    firstName: string;
    lastName: string;
    middleName: string;
    state: string;
    dob: string;
    exclusionType: string;
    exclusionDate: string;
    specialty: string;
  }>;
  datasetLoaded: boolean;
  recordCount: number;
  datasetLastUpdated: string | null;
};

export function OigCheckButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/hr/verification/oig-check/${applicationId}`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "OIG check failed.");
        return;
      }
      setResult(payload.result);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button type="button" size="sm" onClick={runCheck} disabled={busy} className="self-start">
        {busy ? <><Loader2 size={14} className="animate-spin" /> Running OIG check…</> : <>Run automated OIG check</>}
      </Button>

      {error && <p className="text-xs text-red-700">{error}</p>}

      {result && !result.datasetLoaded && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          OIG dataset has not been downloaded yet. An admin can trigger the download from System Health, or it will run on the next daily job tick.
        </p>
      )}

      {result && result.datasetLoaded && result.matchType === "none" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900 flex items-start gap-2">
          <ShieldCheck size={14} className="text-emerald-700 mt-0.5" />
          <div>
            <p className="font-semibold">No match on OIG LEIE</p>
            <p className="text-[11px] text-emerald-700">Checked against {result.recordCount.toLocaleString()} records · Dataset updated {result.datasetLastUpdated?.slice(0, 10) ?? "unknown"}</p>
          </div>
        </div>
      )}

      {result && result.datasetLoaded && result.matchType !== "none" && (
        <div className={`rounded-md border p-2 text-xs ${result.matchType === "exact_with_dob" ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className={result.matchType === "exact_with_dob" ? "text-red-700" : "text-amber-700"} />
            <p className="font-semibold">
              {result.matchType === "exact_with_dob" ? "EXCLUSION MATCH FOUND (name + DOB)" : "Possible match on name only — HR must review"}
            </p>
          </div>
          <p className="mt-1 text-[11px]">{result.matches.length} record{result.matches.length === 1 ? "" : "s"} matched:</p>
          <ul className="mt-1 grid gap-1">
            {result.matches.slice(0, 5).map((m, idx) => (
              <li key={idx} className="rounded border bg-white p-1.5">
                <span className="font-semibold">{m.firstName} {m.middleName} {m.lastName}</span>
                {m.state && <> · {m.state}</>}
                {m.dob && <> · DOB {m.dob}</>}
                {m.exclusionType && <> · {m.exclusionType}</>}
                {m.exclusionDate && <> · excluded {m.exclusionDate}</>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
