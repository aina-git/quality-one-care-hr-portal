"use client";

import { useEffect, useState } from "react";
import { Pencil, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function HrPediatricExperienceEditor({
  applicationId,
  initial
}: {
  applicationId: string;
  initial: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Auto-open when arriving via the Open Issues fix link.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#card-pediatric") {
      setEditing(true);
    }
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/applicant-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({ pediatricExperience: text })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Could not save.");
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch (err) {
      setError("Could not save.");
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-500">If the answer is in the application form, paste/type it here.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={12} /> Edit
          </Button>
        </div>
        {initial ? (
          <p className="whitespace-pre-wrap text-sm text-slate-800">{initial}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">Applicant did not complete the pediatric experience section.</p>
        )}
      </>
    );
  }

  return (
    <div className="grid gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        maxLength={4000}
        className="w-full rounded-md border bg-white px-3 py-2 text-sm"
        placeholder="Describe the applicant's pediatric experience: years, settings, ages, conditions, etc."
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(false)}>
          <X size={12} /> Cancel
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={save}>
          <Save size={12} /> {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
