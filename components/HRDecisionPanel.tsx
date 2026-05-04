"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const actions = [
  ["proceed_to_interview", "Proceed to Interview"],
  ["request_clarification", "Request Clarification"],
  ["place_on_hold", "Place on Hold"],
  ["mark_not_selected", "Mark Not Selected"],
  ["approve_for_onboarding", "Approve for Onboarding"]
];

export function HRDecisionPanel({ applicationId }: { applicationId: string }) {
  const [action, setAction] = useState("request_clarification");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/hr/applications/${applicationId}/decision`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ action, note })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Decision could not be saved.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <select value={action} onChange={(event) => setAction(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
        {actions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        required
        rows={4}
        placeholder="Required HR decision note"
        className="rounded-md border bg-white px-3 py-2 text-sm"
      />
      <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save Decision"}</Button>
      {message && <p className="text-sm text-orange-700">{message}</p>}
    </form>
  );
}
