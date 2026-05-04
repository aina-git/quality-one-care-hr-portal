"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function InterviewScheduler({
  applicationId,
  interviewId,
  scheduledAt,
  location,
  notes
}: {
  applicationId: string;
  interviewId?: string;
  scheduledAt?: string | null;
  location?: string | null;
  notes?: string | null;
}) {
  const [dateTime, setDateTime] = useState(scheduledAt ? scheduledAt.slice(0, 16) : "");
  const [place, setPlace] = useState(location ?? "");
  const [detail, setDetail] = useState(notes ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/hr/applications/${applicationId}/interview`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ interviewId, scheduledAt: dateTime, location: place, notes: detail })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Interview could not be saved.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  async function cancel() {
    if (!interviewId) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/hr/applications/${applicationId}/interview`, {
      method: "PATCH",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ interviewId, status: "cancelled", notes: detail || "Cancelled by HR." })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Interview could not be cancelled.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={save} className="grid gap-3">
      <input
        type="datetime-local"
        value={dateTime}
        onChange={(event) => setDateTime(event.target.value)}
        required
        className="h-10 rounded-md border bg-white px-3 text-sm"
      />
      <input
        value={place}
        onChange={(event) => setPlace(event.target.value)}
        placeholder="Location, phone, or video details"
        className="h-10 rounded-md border bg-white px-3 text-sm"
      />
      <textarea
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        rows={3}
        placeholder="Interview notes visible to the applicant"
        className="rounded-md border bg-white px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving..." : interviewId ? "Update Interview" : "Schedule Interview"}</Button>
        {interviewId && <Button type="button" variant="outline" onClick={cancel} disabled={busy}>Cancel Interview</Button>}
      </div>
      {message && <p className="text-sm text-orange-700">{message}</p>}
    </form>
  );
}
