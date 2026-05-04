"use client";

import type { DonDecision } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const decisions: Array<[DonDecision, string]> = [
  ["approved_for_hire", "Approved for Hire"],
  ["not_approved", "Not Approved"],
  ["returned_for_correction", "Returned for Correction"]
];

export function DonDecisionForm({
  applicationId,
  canApprove
}: {
  applicationId: string;
  canApprove: boolean;
}) {
  const [decision, setDecision] = useState<DonDecision>(canApprove ? "approved_for_hire" : "returned_for_correction");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/don/final-approval/${applicationId}/decision`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ decision, comment })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "DON decision could not be submitted.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="font-medium">DON Decision</span>
        <select value={decision} onChange={(event) => setDecision(event.target.value as DonDecision)} className="h-10 rounded-md border bg-white px-3">
          {decisions.map(([value, label]) => (
            <option key={value} value={value} disabled={value === "approved_for_hire" && !canApprove}>
              {label}{value === "approved_for_hire" && !canApprove ? " - blocked until checklist is complete" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">DON Comments</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          className="rounded-md border bg-white px-3 py-2"
          placeholder="Record the final decision rationale or correction request."
        />
      </label>
      <Button type="submit" disabled={busy}>{busy ? "Submitting..." : "Submit Decision"}</Button>
      {message ? <p className="text-sm text-orange-700">{message}</p> : null}
    </form>
  );
}
