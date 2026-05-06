"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

// Re-runs OCR + auto-map on every document attached to the application.
// Useful for applicants whose docs were uploaded before auto-map existed,
// or to retry after extraction logic improves.
export function HrReprocessButton({ applicationId }: { applicationId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => run("full")}>
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} /> {busy ? "Re-running OCR…" : "Re-run OCR + auto-fill"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => run("remap-only")}>
          Auto-fill from existing extraction
        </Button>
      </div>
      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
