"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const reasons = ["Identity unclear", "Photo mismatch", "Request new photo"];

export function IdentityPhotoFlagForm({ applicantProfileId }: { applicantProfileId: string }) {
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/hr/applicants/${applicantProfileId}/identity-photo`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ reason, note })
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Photo could not be flagged.");
      return;
    }
    setMessage("Photo review note saved.");
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border bg-slate-50 p-3">
      <select value={reason} onChange={(event) => setReason(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
        {reasons.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="rounded-md border bg-white px-3 py-2 text-sm" placeholder="Add HR identity verification note." />
      <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Flag / Request New Photo"}</Button>
      {message ? <p className="text-xs font-medium text-orange-700">{message}</p> : null}
    </form>
  );
}
