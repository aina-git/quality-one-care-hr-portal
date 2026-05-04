"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Copy, Check, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCsrfHeaders } from "@/lib/csrf-client";

type CaptureField = { key: string; label: string; required?: boolean; placeholder?: string };

export type AssistantConfig = {
  category: string;
  providerName: string;
  description: string;
  url: string;
  copyText: string;
  searchHints: string[];
  captureFields: CaptureField[];
};

export function VerificationAssistantPanel({
  applicationId,
  itemId,
  config
}: {
  applicationId: string;
  itemId: string;
  config: AssistantConfig;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);
  const [resolution, setResolution] = useState<"verified" | "failed" | "needs_followup">("verified");
  const [captures, setCaptures] = useState<Record<string, string>>({});
  const [referenceNumber, setReferenceNumber] = useState("");
  const [hrNote, setHrNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function copyApplicantData() {
    void navigator.clipboard.writeText(config.copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openSite() {
    window.open(config.url, "_blank", "noopener,noreferrer");
    setOpened(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const missing = config.captureFields.filter((f) => f.required && !captures[f.key]?.trim());
    if (missing.length > 0) {
      setMessage({ tone: "err", text: `Required: ${missing.map((m) => m.label).join(", ")}` });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const noteParts = config.captureFields
        .map((f) => captures[f.key] ? `${f.label}: ${captures[f.key]}` : null)
        .filter(Boolean);
      const fullNote = [
        `Manual verification via ${config.providerName}`,
        ...noteParts,
        hrNote ? `HR note: ${hrNote}` : null
      ].filter(Boolean).join("\n");

      const response = await fetch(`/api/hr/verification/items/${itemId}/update`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          status: resolution,
          notes: fullNote,
          externalReferenceNumber: referenceNumber || `${config.category}-${Date.now()}`,
          source: config.providerName,
          result: resolution === "verified" ? "Verified via manual lookup" : resolution === "failed" ? "Failed manual lookup — concerns found" : "Needs additional follow-up"
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save verification." });
        return;
      }
      setMessage({ tone: "ok", text: "Verification recorded. Audit trail saved." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-md border border-blue-200 bg-blue-50/40 p-4 text-sm">
      <div>
        <p className="font-semibold text-blue-900">Manual lookup helper — {config.providerName}</p>
        <p className="mt-0.5 text-xs text-slate-700">{config.description}</p>
      </div>

      {/* Step 1: copy applicant data */}
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-slate-700 mb-1">Step 1 — Copy applicant data</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-slate-100 px-2 py-1 text-xs">{config.copyText || "(no data available)"}</code>
          <Button type="button" size="sm" variant="outline" onClick={copyApplicantData}>
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </Button>
        </div>
      </div>

      {/* Step 2: open site */}
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-slate-700 mb-1">Step 2 — Open the verification site</p>
        <Button type="button" size="sm" onClick={openSite} className="self-start">
          <ExternalLink size={14} /> Open {config.providerName}
        </Button>
        {opened && <p className="mt-1 text-xs text-emerald-700">✓ Opened in new tab — paste the data and run the search</p>}
      </div>

      {/* Search hints */}
      <details className="rounded-md border border-slate-200 bg-white p-3" open>
        <summary className="cursor-pointer text-xs font-semibold text-slate-700">What to capture</summary>
        <ul className="mt-2 grid gap-1 list-disc list-inside text-xs text-slate-700">
          {config.searchHints.map((hint) => <li key={hint}>{hint}</li>)}
        </ul>
      </details>

      {/* Step 3: record result */}
      <form onSubmit={submit} className="rounded-md border border-slate-200 bg-white p-3 grid gap-3">
        <p className="text-xs font-semibold text-slate-700">Step 3 — Record what you found</p>

        <div className="grid gap-1.5 text-xs">
          <label className="font-medium text-slate-700">Outcome</label>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name={`outcome-${itemId}`} value="verified" checked={resolution === "verified"} onChange={() => setResolution("verified")} />
              <ShieldCheck size={12} className="text-emerald-700" /> Verified — clean
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name={`outcome-${itemId}`} value="failed" checked={resolution === "failed"} onChange={() => setResolution("failed")} />
              <AlertTriangle size={12} className="text-red-700" /> Failed — concerns found
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name={`outcome-${itemId}`} value="needs_followup" checked={resolution === "needs_followup"} onChange={() => setResolution("needs_followup")} />
              Needs follow-up
            </label>
          </div>
        </div>

        <div className="grid gap-2">
          {config.captureFields.map((f) => (
            <label key={f.key} className="grid gap-1 text-xs">
              <span className="font-medium text-slate-700">{f.label}{f.required && <span className="text-red-700"> *</span>}</span>
              <Input
                value={captures[f.key] ?? ""}
                onChange={(e) => setCaptures({ ...captures, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                required={f.required}
              />
            </label>
          ))}
          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-700">Reference / tracking number (optional)</span>
            <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Auto-generated if blank" />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-700">HR note (optional)</span>
            <textarea value={hrNote} onChange={(e) => setHrNote(e.target.value)} rows={2} className="rounded-md border bg-white px-2 py-1 text-xs" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save verification"}
          </Button>
          {message && <p className={message.tone === "ok" ? "text-xs text-emerald-700" : "text-xs text-red-700"}>{message.text}</p>}
        </div>
      </form>
    </div>
  );
}
