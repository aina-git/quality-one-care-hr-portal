"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, ShieldAlert, ShieldCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

type FindingField = "name" | "dateOfBirth" | "licenseNumber" | "licenseType" | "address";

type Override = {
  id: string;
  reason: string;
  overriddenAt: string;
  overriddenByName: string | null;
  overriddenByEmail: string | null;
};

type Finding = {
  field: FindingField;
  rawSeverity: "ok" | "warning" | "critical";
  severity: "ok" | "warning" | "critical";
  applicationValue: string | null;
  documentValue: string | null;
  documentId: string | null;
  documentName: string | null;
  message: string;
  override?: Override | null;
};

type Report = {
  consistencyScore: number;
  totalChecks: number;
  okCount: number;
  warningCount: number;
  criticalCount: number;
  overriddenCount: number;
  findings: Finding[];
};

const fieldLabel: Record<FindingField, string> = {
  name: "Full name",
  dateOfBirth: "Date of birth",
  licenseNumber: "License number",
  licenseType: "License type",
  address: "Address"
};

export function CrossValidationPanel({ applicationId, canOverride = true }: { applicationId: string; canOverride?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<{ field: FindingField; documentId: string | null; idx: number } | null>(null);
  const [resolveReason, setResolveReason] = useState("");
  const [resolveBusy, setResolveBusy] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState<string | null>(null);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

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

  async function submitResolve() {
    if (!resolveTarget) return;
    if (!resolveReason.trim()) {
      setError("Reason is required to resolve a finding.");
      return;
    }
    const finding = report?.findings[resolveTarget.idx];
    if (!finding) return;
    setResolveBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/hr/verification/cross-validation/${applicationId}/overrides`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          field: finding.field,
          documentId: finding.documentId,
          applicationValue: finding.applicationValue,
          documentValue: finding.documentValue,
          reason: resolveReason
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Could not record override.");
        return;
      }
      setResolveTarget(null);
      setResolveReason("");
      await run();
    } catch {
      setError("Network error.");
    } finally {
      setResolveBusy(false);
    }
  }

  async function revoke(overrideId: string) {
    if (!confirm("Revoke this override? The cross-check finding will reappear.")) return;
    setRevokeBusy(overrideId);
    setError(null);
    try {
      const res = await fetch(`/api/hr/verification/cross-validation/${applicationId}/overrides?id=${encodeURIComponent(overrideId)}`, {
        method: "DELETE",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ reason: null })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Could not revoke override.");
        return;
      }
      await run();
    } catch {
      setError("Network error.");
    } finally {
      setRevokeBusy(null);
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
          {busy ? <><Loader2 size={14} className="animate-spin" /> Running…</> : "Re-run cross-check"}
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
                <p className="text-slate-500">
                  {report.totalChecks} check{report.totalChecks === 1 ? "" : "s"}
                  {report.overriddenCount > 0 && <span className="ml-1">· {report.overriddenCount} resolved by HR</span>}
                </p>
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
              const isOverridden = Boolean(f.override);
              const Icon = isOverridden ? ShieldCheck
                : f.severity === "ok" ? CheckCircle2
                : f.severity === "warning" ? AlertTriangle
                : ShieldAlert;
              const tone = isOverridden ? "text-blue-700"
                : f.severity === "ok" ? "text-emerald-700"
                : f.severity === "warning" ? "text-amber-700"
                : "text-red-700";
              const bg = isOverridden ? "bg-blue-50/60"
                : f.severity === "ok" ? "bg-emerald-50/50"
                : f.severity === "warning" ? "bg-amber-50/50"
                : "bg-red-50/50";
              const showResolve = canOverride && f.rawSeverity !== "ok" && !isOverridden;
              return (
                <div key={idx} className={`rounded-md border border-slate-100 p-2 text-xs ${bg}`}>
                  <div className="flex items-start gap-2">
                    <Icon size={14} className={`${tone} mt-0.5 flex-shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-900">
                          {fieldLabel[f.field]}: {isOverridden ? "Resolved by HR" : f.message}
                        </p>
                        {showResolve && (
                          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => { setResolveTarget({ field: f.field, documentId: f.documentId, idx }); setResolveReason(""); }}>
                            Resolve
                          </Button>
                        )}
                        {isOverridden && canOverride && f.override && (
                          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => revoke(f.override!.id)} disabled={revokeBusy === f.override.id}>
                            <Undo2 size={11} className="mr-1" /> {revokeBusy === f.override.id ? "Revoking…" : "Revoke"}
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600">
                        App says: <span className="font-mono">{f.applicationValue || "—"}</span>
                        {" · "}Document says: <span className="font-mono">{f.documentValue || "—"}</span>
                      </p>
                      {f.documentName && <p className="text-[11px] text-slate-500">From: {f.documentName}</p>}
                      {isOverridden && f.override && (
                        <p className="mt-1 rounded border border-blue-200 bg-white p-1.5 text-[11px] text-blue-900">
                          <span className="font-medium">Resolved by {f.override.overriddenByName ?? f.override.overriddenByEmail ?? "HR"}</span>
                          {" on "}
                          <span>{new Date(f.override.overriddenAt).toLocaleDateString()}</span>
                          {": "}{f.override.reason}
                        </p>
                      )}

                      {resolveTarget && resolveTarget.idx === idx && (
                        <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
                          <label className="grid gap-1">
                            <span className="text-[11px] font-medium text-slate-700">Reason for resolving (required)</span>
                            <textarea
                              className="min-h-[60px] w-full rounded border border-slate-200 px-2 py-1 text-xs"
                              value={resolveReason}
                              onChange={(e) => setResolveReason(e.target.value)}
                              placeholder="e.g. Maiden name on transcript; verified with applicant; documented in HR notes."
                            />
                          </label>
                          <div className="mt-2 flex items-center gap-2">
                            <Button type="button" size="sm" onClick={submitResolve} disabled={resolveBusy}>
                              {resolveBusy ? "Saving…" : "Save resolution"}
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => { setResolveTarget(null); setResolveReason(""); }}>Cancel</Button>
                          </div>
                        </div>
                      )}
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
