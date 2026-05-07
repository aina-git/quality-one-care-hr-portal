"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Props = {
  itemId: string;
  itemTitle: string;
  reason: string;
  applicationId: string;
};

/**
 * Inline expansion of a Critical Blocker row that lets HR re-verify the item
 * without leaving the banner. One-click "Verified — keeps current dates" or
 * fill in a new expiration + optional notes and save. After save, the page
 * server-refreshes so the blocker disappears from the banner.
 */
export function BlockerQuickFix({ itemId, itemTitle, reason }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save(opts: { status: "verified" | "needs_followup"; needsExpiration: boolean }) {
    if (opts.needsExpiration && !expirationDate) {
      setError("Pick a new expiration date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/hr/verification/items/${itemId}/update`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          status: opts.status,
          ...(expirationDate ? { expirationDate } : {}),
          ...(notes.trim() ? { notes } : {})
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Could not update item.");
        setBusy(false);
        return;
      }
      setDone(true);
      // Brief flash, then refresh to drop this row from the banner.
      setTimeout(() => router.refresh(), 350);
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <li className="flex items-center gap-2 text-sm text-emerald-800">
        <Check size={14} /> {itemTitle} <span className="italic">— resolved</span>
      </li>
    );
  }

  return (
    <li className="text-sm text-red-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-left hover:underline"
      >
        {itemTitle} <span className="text-red-600 italic">({reason})</span>
        <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 grid gap-2 rounded-md border border-red-200 bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <label className="grid gap-0.5 text-xs">
              <span className="font-medium text-slate-700">New expiration date (if renewed)</span>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              />
            </label>
            <Button
              type="button"
              size="sm"
              className="self-end bg-emerald-600 hover:bg-emerald-700"
              onClick={() => save({ status: "verified", needsExpiration: false })}
              disabled={busy}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Mark verified
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-end"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Close
            </Button>
          </div>
          <label className="grid gap-0.5 text-xs">
            <span className="font-medium text-slate-700">Optional note (e.g., source document, renewal #)</span>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Renewed via portal 5/7/2026" />
          </label>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <p className="text-[11px] text-slate-500">
            Tip: leave the date blank if the credential never expires (e.g. background check passed). Click Mark verified to clear the blocker.
          </p>
        </div>
      )}
    </li>
  );
}
