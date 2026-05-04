"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const actions = [
  ["start_hr_review", "Start HR review"],
  ["mark_verification_in_progress", "Pass to verification"],
  ["request_missing_document", "Request missing document"],
  ["return_to_applicant", "Return to applicant"],
  ["put_on_hold", "Put on hold"],
  ["reject_hr_screening", "Reject at HR screening"],
  ["mark_ready_for_don_review", "Mark ready for DON review"],
  ["submit_to_don", "Submit to DON"],
  ["archive_application", "Archive application"]
] as const;

const seriousActions = new Set(["submit_to_don", "reject_hr_screening", "archive_application"]);

function availableActions(status?: string) {
  if (status === "hr_review_pending") return actions.filter(([value]) => value === "start_hr_review" || value === "request_missing_document" || value === "reject_hr_screening" || value === "put_on_hold");
  if (status === "hr_review_started" || status === "under_review" || status === "ai_issues_found") return actions.filter(([value]) => ["mark_verification_in_progress", "request_missing_document", "return_to_applicant", "put_on_hold", "reject_hr_screening"].includes(value));
  if (status === "verification_in_progress" || status === "ready_for_verification" || status === "verification_passed") return actions.filter(([value]) => ["mark_ready_for_don_review", "submit_to_don", "request_missing_document", "put_on_hold", "reject_hr_screening"].includes(value));
  if (status === "ready_for_don_review") return actions.filter(([value]) => ["submit_to_don", "put_on_hold"].includes(value));
  return actions;
}

function defaultAction(status?: string): (typeof actions)[number][0] {
  if (status === "hr_review_started" || status === "under_review" || status === "ai_issues_found") return "mark_verification_in_progress";
  if (status === "verification_in_progress" || status === "ready_for_verification" || status === "verification_passed") return "mark_ready_for_don_review";
  if (status === "ready_for_don_review") return "submit_to_don";
  return "start_hr_review";
}

export function ApplicationWorkflowControls({ applicationId, currentStatus }: { applicationId: string; currentStatus?: string }) {
  const router = useRouter();
  const choices = availableActions(currentStatus);
  const [action, setAction] = useState<(typeof actions)[number][0]>(defaultAction(currentStatus));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!note.trim()) {
      setMessage("A reason or comment is required.");
      return;
    }
    if (seriousActions.has(action) && !window.confirm("Please confirm this workflow action. It will update the application record and audit trail.")) {
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/hr/applications/${applicationId}/workflow-action`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ action, note })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Workflow action could not be completed.");
      setBusy(false);
      return;
    }
    setMessage(payload.message ?? "Workflow updated.");
    router.refresh();
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Workflow action</span>
        <select value={action} onChange={(event) => setAction(event.target.value as typeof action)} className="h-10 rounded-md border bg-white px-3">
          {choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Reason / comment</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="rounded-md border bg-white px-3 py-2" placeholder="Add the reason, missing document, or next action note." />
      </label>
      <Button type="submit" disabled={busy}>{busy ? "Updating..." : "Apply Workflow Action"}</Button>
      {message ? <p className="text-sm font-medium text-orange-700">{message}</p> : null}
    </form>
  );
}
