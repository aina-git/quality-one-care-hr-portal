"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function StageGateActionButtons({
  applicationId,
  defaultNote
}: {
  applicationId: string;
  defaultNote: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState(defaultNote);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function run(action: "request_missing_document" | "reject_hr_screening" | "put_on_hold") {
    if (!note.trim()) {
      setMessage("A reason/comment is required before moving this case.");
      return;
    }
    if ((action === "reject_hr_screening" || action === "put_on_hold") && !window.confirm("Confirm this workflow action. It will update the application status and audit trail.")) {
      return;
    }
    try {
      setBusyAction(action);
      setMessage("");
      const response = await fetch(`/api/hr/applications/${applicationId}/workflow-action`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ action, note })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Workflow action could not be completed.");
        return;
      }
      setMessage(payload.message ?? "Workflow updated.");
      router.refresh();
    } catch {
      setMessage("Workflow action could not be completed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-orange-200 bg-white p-4">
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-slate-950">Required reason / applicant message</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          className="rounded-md border bg-white px-3 py-2"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => run("request_missing_document")} disabled={Boolean(busyAction)}>
          {busyAction === "request_missing_document" ? "Sending..." : "Request Applicant Corrections"}
        </Button>
        <Button type="button" variant="outline" onClick={() => run("put_on_hold")} disabled={Boolean(busyAction)}>
          {busyAction === "put_on_hold" ? "Updating..." : "Place On Hold"}
        </Button>
        <Button type="button" variant="outline" className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100" onClick={() => run("reject_hr_screening")} disabled={Boolean(busyAction)}>
          {busyAction === "reject_hr_screening" ? "Rejecting..." : "Reject at HR Screening"}
        </Button>
      </div>
      {message ? <p className="text-sm font-semibold text-orange-700">{message}</p> : null}
    </div>
  );
}
