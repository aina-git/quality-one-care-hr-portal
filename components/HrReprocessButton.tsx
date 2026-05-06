"use client";

import { useState } from "react";
import { RefreshCw, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const WIPE_CONFIRM = "WIPE";

// Re-runs OCR + auto-map on every document attached to the application.
// Useful for applicants whose docs were uploaded before auto-map existed,
// or to retry after extraction logic improves. Also exposes a destructive
// "wipe + restart" path for cleaning up garbage from the old (loose)
// regex patterns before re-running with new ones.
export function HrReprocessButton({ applicationId }: { applicationId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [typed, setTyped] = useState("");

  async function run(mode: "full" | "remap-only") {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/reprocess?mode=${mode}`, {
        method: "POST",
        headers: getCsrfHeaders()
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Could not reprocess.");
        setBusy(false);
        return;
      }
      setMessage(`Done — re-OCR'd ${payload.processedDocs} doc(s), auto-filled ${payload.mapped} field(s). Reloading…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setError("Could not reprocess.");
      setBusy(false);
    }
  }

  async function wipeAndRestart() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const wipeRes = await fetch(`/api/admin/applications/${applicationId}/wipe-extracted`, {
        method: "POST",
        headers: getCsrfHeaders()
      });
      const wipePayload = await wipeRes.json().catch(() => ({}));
      if (!wipeRes.ok) {
        setError(wipePayload.error ?? "Could not wipe extracted data.");
        setBusy(false);
        return;
      }
      setMessage("Wiped previous extraction. Re-running OCR with new patterns…");
      const res = await fetch(`/api/admin/applications/${applicationId}/reprocess?mode=full`, {
        method: "POST",
        headers: getCsrfHeaders()
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Wipe succeeded but reprocess failed.");
        setBusy(false);
        return;
      }
      setMessage(`Done — wiped + re-OCR'd ${payload.processedDocs} doc(s), auto-filled ${payload.mapped} field(s). Reloading…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setError("Could not wipe + reprocess.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => run("full")}>
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} /> {busy ? "Re-running OCR…" : "Re-run OCR + auto-fill"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => run("remap-only")}>
          Auto-fill from existing extraction
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={() => setWipeOpen(true)}
        >
          <Eraser size={12} /> Wipe & restart
        </Button>
      </div>
      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}

      {wipeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setWipeOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="flex items-center gap-2 text-base font-semibold text-red-700">
              <Eraser size={16} /> Wipe extracted data and start over?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              This deletes everything the OCR / auto-fill pipeline produced and re-runs OCR from scratch on every
              uploaded document. Useful when previous auto-fills got the wrong data.
            </p>
            <ul className="mt-2 list-disc pl-5 text-xs text-slate-600 space-y-0.5">
              <li>Clears phone, date of birth, address, pediatric experience on the profile</li>
              <li>Deletes all employment history, licenses, certifications, and references on this application</li>
              <li>Discards previous OCR text and extracted-field rows</li>
              <li>Keeps the uploaded document files, the applicant&apos;s account, HR notes, and decisions</li>
            </ul>
            <p className="mt-2 text-xs text-amber-700">
              Anything you typed in by hand on this application will also be cleared. The action cannot be undone.
            </p>
            <p className="mt-3 text-xs text-slate-700">
              Type <span className="font-mono font-semibold text-red-700">{WIPE_CONFIRM}</span> to confirm:
            </p>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder={WIPE_CONFIRM}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setWipeOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || typed !== WIPE_CONFIRM}
                className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                onClick={() => { setWipeOpen(false); setTyped(""); wipeAndRestart(); }}
              >
                <Eraser size={12} /> Wipe and restart
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
