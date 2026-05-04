"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Finding = {
  field: "name" | "dateOfBirth" | "licenseNumber" | "licenseType" | "address";
  severity: "ok" | "warning" | "critical";
  applicationValue: string | null;
  documentValue: string | null;
  documentName: string | null;
  message: string;
};

type Report = {
  consistencyScore: number;
  totalChecks: number;
  okCount: number;
  warningCount: number;
  criticalCount: number;
  findings: Finding[];
};

const fieldLabel: Record<Finding["field"], string> = {
  name: "Full name",
  dateOfBirth: "Date of birth",
  licenseNumber: "License number",
  licenseType: "License type",
  address: "Address"
};

export function CrossValidationPanel({ applicationId }: { applicationId: string }) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/hr/verification/cross-validation/${applicationId}`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Cross-validation failed.");
        return;
      }
      setReport(payload.report);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Identity Cross-Check</p>
          <p className="text-xs text-slate-600">Compares the applicant&apos;s name, DOB, license, and address across every uploaded document.</p>
        </div>
        <Button type="button" size="sm" onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Running…</> : "Run cross-check"}
        </Button>
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      {report && report.totalChecks === 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          No extractable identity fields found across documents yet. Upload more credentials or wait for OCR to complete.
        </p>
      )}

      {report && report.totalChecks > 0 && (
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`text-2xl font-bold ${report.consistencyScore >= 90 ? "text-emerald-700" : report.consistencyScore >= 70 ? "text-amber-700" : "text-red-700"}`}>
                {report.consistencyScore}%
              </div>
              <div className="text-xs">
                <p className="font-medium text-slate-700">Consistency score</p>
                <p className="text-slate-500">{report.totalChecks} check{report.totalChecks === 1 ? "" : "s"}</p>
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              {report.okCount > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">{report.okCount} ✓</span>}
              {report.warningCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">{report.warningCount} ⚠</span>}
              {report.criticalCount > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">{report.criticalCount} ✗</span>}
            </div>
          </div>

          <div className="grid gap-1.5">
            {report.findings.map((f, idx) => {
              const Icon = f.severity === "ok" ? CheckCircle2 : f.severity === "warning" ? AlertTriangle : ShieldAlert;
              const tone = f.severity === "ok" ? "text-emerald-700" : f.severity === "warning" ? "text-amber-700" : "text-red-700";
              const bg = f.severity === "ok" ? "bg-emerald-50/50" : f.severity === "warning" ? "bg-amber-50/50" : "bg-red-50/50";
              return (
                <div key={idx} className={`rounded-md border border-slate-100 p-2 text-xs ${bg}`}>
                  <div className="flex items-start gap-2">
                    <Icon size={14} className={`${tone} mt-0.5 flex-shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{fieldLabel[f.field]}: {f.message}</p>
                      <p className="text-[11px] text-slate-600">
                        App says: <span className="font-mono">{f.applicationValue || "—"}</span>
                        {" · "}Document says: <span className="font-mono">{f.documentValue || "—"}</span>
                      </p>
                      {f.documentName && <p className="text-[11px] text-slate-500">From: {f.documentName}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
