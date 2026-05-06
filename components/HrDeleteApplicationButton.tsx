"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const CONFIRM = "DELETE";

// HR-side delete control. Hard-deletes any application via /api/admin/applications/[id].
// Requires the operator to type DELETE in the modal. On success, refreshes the page.
export function HrDeleteApplicationButton({
  applicationId,
  applicantName,
  size = "sm"
}: {
  applicationId: string;
  applicantName: string;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}`, {
        method: "DELETE",
        headers: getCsrfHeaders()
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Could not delete the application.");
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch (err) {
      setError("Could not delete the application.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant="outline"
        className="border-red-300 text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={14} /> Delete
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-red-700">
              <Trash2 size={18} /> Delete this application?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Permanently delete <span className="font-semibold">{applicantName}</span>&apos;s application and all related data:
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 space-y-0.5">
              <li>All uploaded documents</li>
              <li>All licenses, certifications, references, employment history</li>
              <li>All AI review reports, findings, HR notes, and decisions</li>
              <li>All status history, tasks, and reminders attached to this application</li>
            </ul>
            <p className="mt-3 text-sm text-amber-700">
              The applicant&apos;s account stays intact, so they can submit a new application. The action cannot be undone.
            </p>
            <p className="mt-3 text-sm text-slate-700">
              Type <span className="font-mono font-semibold text-red-700">{CONFIRM}</span> to confirm:
            </p>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder={CONFIRM}
            />
            {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                type="button"
                disabled={busy || typed !== CONFIRM}
                className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                onClick={doDelete}
              >
                <Trash2 size={14} /> {busy ? "Deleting…" : "Delete permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
