"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Finding = {
  id?: string;
  severity: string;
  title: string;
  description: string;
};

type AiReport = {
  id: string;
  status: string;
  overallRiskLevel: string;
  recommendation: string;
  summary: string | null;
  findings: Finding[];
} | { error: string } | null;

type CrossValFinding = {
  field: string;
  severity: "ok" | "warning" | "critical";
  applicationValue: string | null;
  documentValue: string | null;
  documentName: string | null;
  message: string;
};

type CrossValReport = {
  consistencyScore: number;
  totalChecks: number;
  okCount: number;
  warningCount: number;
  criticalCount: number;
  findings: CrossValFinding[];
} | { error: string } | null;

type OigResult = {
  matched: boolean;
  matchType: "none" | "exact_with_dob" | "name_only";
  recordCount: number;
  datasetLastUpdated: string | null;
  matches: Array<{ firstName: string; lastName: string; state: string; dob: string; exclusionType: string }>;
} | { error: string } | null;

const FIELD_LABEL: Record<string, string> = {
  name: "Full name",
  dateOfBirth: "Date of birth",
  licenseNumber: "License number",
  licenseType: "License type",
  address: "Address"
};

export function AiAnalysisPanel({
  applicationId,
  initialAiReport,
  initialOigResult
}: {
  applicationId: string;
  initialAiReport?: AiReport;
  initialOigResult?: OigResult;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<AiReport>(initialAiReport ?? null);
  const [crossVal, setCrossVal] = useState<CrossValReport>(null);
  const [oig, setOig] = useState<OigResult>(initialOigResult ?? null);

  async function runFullAnalysis() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/hr/applications/${applicationId}/full-analysis`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "AI analysis failed.");
        return;
      }
      setAiReport(payload.aiReport ?? null);
      setCrossVal(payload.crossValidation ?? null);
      setOig(payload.oig ?? null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const aiOk = aiReport && !("error" in aiReport);
  const crossOk = crossVal && !("error" in crossVal);
  const oigOk = oig && !("error" in oig);
  const hasAnyResult = Boolean(aiOk || crossOk || oigOk);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900 flex items-center gap-2"><Brain size={16} className="text-blue-700" /> AI Analysis</p>
          <p className="text-xs text-slate-600">Auto-runs the AI review, identity cross-check, and federal OIG exclusion check. Use the results to inform your green / amber / red call.</p>
        </div>
        <Button type="button" onClick={runFullAnalysis} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Running…</> : hasAnyResult ? "Re-run AI analysis" : "Run AI analysis"}
        </Button>
      </div>

      {error && <p className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">{error}</p>}

      {/* SECTION 1 — AI Review Verdict */}
      <div className={`rounded-md border p-3 ${aiOk ? "border-blue-200 bg-blue-50/40" : "border-dashed border-slate-300 bg-white"}`}>
        <div className="flex items-center gap-2">
          <Brain size={14} className={aiOk ? "text-blue-700" : "text-slate-400"} />
          <p className="text-sm font-semibold text-slate-900">1. AI Review Verdict</p>
        </div>
        {!aiOk ? (
          <p className="mt-2 text-xs text-slate-500">{aiReport && "error" in aiReport ? aiReport.error : "Click 'Run AI analysis' above."}</p>
        ) : (
          <div className="mt-2 grid gap-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                aiReport.overallRiskLevel === "low" ? "bg-emerald-100 text-emerald-900" :
                aiReport.overallRiskLevel === "moderate" ? "bg-amber-100 text-amber-900" :
                aiReport.overallRiskLevel === "high" ? "bg-red-100 text-red-900" :
                "bg-slate-100 text-slate-700"
              }`}>RISK: {aiReport.overallRiskLevel.replace(/_/g, " ").toUpperCase()}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800">RECOMMENDATION: {aiReport.recommendation.replace(/_/g, " ").toUpperCase()}</span>
            </div>
            {aiReport.summary && <p className="text-slate-800">{aiReport.summary}</p>}
            {aiReport.findings.length > 0 && (
              <ul className="grid gap-1 mt-1">
                {aiReport.findings.map((f, idx) => {
                  const Icon = f.severity === "info" ? CheckCircle2 : f.severity === "critical" ? ShieldAlert : AlertTriangle;
                  const tone = f.severity === "info" ? "text-emerald-700" : f.severity === "critical" ? "text-red-700" : "text-amber-700";
                  return (
                    <li key={f.id ?? idx} className="text-xs flex items-start gap-1.5">
                      <Icon size={12} className={`${tone} mt-0.5 flex-shrink-0`} />
                      <span><span className="font-semibold">{f.title}.</span> {f.description}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2 — Cross-Validation */}
      <div className={`rounded-md border p-3 ${crossOk ? "border-blue-200 bg-blue-50/40" : "border-dashed border-slate-300 bg-white"}`}>
        <div className="flex items-center gap-2">
          <Target size={14} className={crossOk ? "text-blue-700" : "text-slate-400"} />
          <p className="text-sm font-semibold text-slate-900">2. Identity Cross-Check</p>
        </div>
        {!crossOk ? (
          <p className="mt-2 text-xs text-slate-500">{crossVal && "error" in crossVal ? crossVal.error : "Will compare applicant data across all uploaded documents."}</p>
        ) : crossVal.totalChecks === 0 ? (
          <p className="mt-2 text-xs text-amber-800">No extractable identity fields found yet — upload more credentials with readable names/DOB/license numbers, then re-run.</p>
        ) : (
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <span className={`text-xl font-bold ${crossVal.consistencyScore >= 90 ? "text-emerald-700" : crossVal.consistencyScore >= 70 ? "text-amber-700" : "text-red-700"}`}>
                {crossVal.consistencyScore}% consistent
              </span>
              <div className="flex gap-1.5 text-[11px]">
                {crossVal.okCount > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">{crossVal.okCount} ✓</span>}
                {crossVal.warningCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">{crossVal.warningCount} ⚠</span>}
                {crossVal.criticalCount > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">{crossVal.criticalCount} ✗</span>}
              </div>
            </div>
            <ul className="mt-2 grid gap-1">
              {crossVal.findings.slice(0, 8).map((f, idx) => {
                const tone = f.severity === "ok" ? "text-emerald-700" : f.severity === "warning" ? "text-amber-700" : "text-red-700";
                const Icon = f.severity === "ok" ? CheckCircle2 : f.severity === "critical" ? ShieldAlert : AlertTriangle;
                return (
                  <li key={idx} className="text-xs flex items-start gap-1.5">
                    <Icon size={12} className={`${tone} mt-0.5 flex-shrink-0`} />
                    <span><span className="font-semibold">{FIELD_LABEL[f.field] ?? f.field}:</span> {f.message}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* SECTION 3 — OIG Federal Exclusion */}
      <div className={`rounded-md border p-3 ${oigOk ? (oig.matchType === "none" ? "border-emerald-200 bg-emerald-50" : "border-red-300 bg-red-50") : "border-dashed border-slate-300 bg-white"}`}>
        <div className="flex items-center gap-2">
          {oigOk && oig.matchType === "none" ? <ShieldCheck size={14} className="text-emerald-700" /> :
            oigOk && oig.matchType !== "none" ? <ShieldAlert size={14} className="text-red-700" /> :
            <ShieldCheck size={14} className="text-slate-400" />}
          <p className="text-sm font-semibold text-slate-900">3. OIG Federal Exclusion (LEIE)</p>
        </div>
        {!oigOk ? (
          <p className="mt-2 text-xs text-slate-500">{oig && "error" in oig ? oig.error : "Will check ~83,000 federal exclusion records."}</p>
        ) : oig.matchType === "none" ? (
          <p className="mt-2 text-xs text-emerald-900">
            <strong>No match found.</strong> Checked against {oig.recordCount.toLocaleString("en-US")} records.
            {oig.datasetLastUpdated && <> Dataset last updated {oig.datasetLastUpdated.slice(0, 10)}.</>}
          </p>
        ) : (
          <div className="mt-2">
            <p className="text-xs font-bold text-red-900">
              {oig.matchType === "exact_with_dob" ? "EXCLUSION MATCH (name + DOB)" : "Possible match (name only) — HR review required"}
            </p>
            <ul className="mt-1 grid gap-0.5 text-xs">
              {oig.matches.slice(0, 5).map((m, idx) => (
                <li key={idx} className="rounded bg-white px-2 py-1 border border-red-200">
                  {m.firstName} {m.lastName} · {m.state} · DOB {m.dob} · {m.exclusionType}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
