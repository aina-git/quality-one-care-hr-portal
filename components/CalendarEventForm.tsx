"use client";

import type { CalendarEventType, CalendarEventVisibility } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const eventTypes: CalendarEventType[] = ["interview", "onboarding", "training", "license_followup", "document_followup", "hr_task", "meeting", "reminder", "other"];

export function CalendarEventForm({ applicationId, applicantUserId }: { applicationId?: string; applicantUserId?: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const startStr = String(form.get("startDateTime") ?? "");
    const endStr = String(form.get("endDateTime") ?? "");
    // Client-side pre-checks so the user sees the issue without a round trip.
    if (!String(form.get("title") ?? "").trim()) {
      setMessage("Please enter an event title.");
      setBusy(false);
      return;
    }
    if (!startStr) {
      setMessage("Please pick a start date and time.");
      setBusy(false);
      return;
    }
    if (!endStr) {
      setMessage("Please pick an end date and time.");
      setBusy(false);
      return;
    }
    if (new Date(endStr) <= new Date(startStr)) {
      setMessage("End time must be after the start time.");
      setBusy(false);
      return;
    }
    const response = await fetch("/api/calendar/events", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description"),
        eventType: form.get("eventType"),
        startDateTime: startStr,
        endDateTime: endStr,
        location: form.get("location"),
        meetingLink: form.get("meetingLink"),
        visibility: form.get("visibility"),
        relatedApplicationId: applicationId || form.get("relatedApplicationId"),
        relatedApplicantUserId: applicantUserId
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Calendar event could not be created.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-2">
      <input name="title" required placeholder="Event title" className="h-10 rounded-md border bg-white px-3 text-sm md:col-span-2" />
      <select name="eventType" defaultValue="meeting" className="h-10 rounded-md border bg-white px-3 text-sm">
        {eventTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
      </select>
      <select name="visibility" defaultValue={applicationId ? "applicant_visible" : "internal"} className="h-10 rounded-md border bg-white px-3 text-sm">
        {(["internal", "applicant_visible", "executive_visible"] as CalendarEventVisibility[]).map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
      </select>
      <input name="startDateTime" type="datetime-local" required className="h-10 rounded-md border bg-white px-3 text-sm" />
      <input name="endDateTime" type="datetime-local" required className="h-10 rounded-md border bg-white px-3 text-sm" />
      <input name="location" placeholder="Location" className="h-10 rounded-md border bg-white px-3 text-sm" />
      <input name="meetingLink" placeholder="Meeting link" className="h-10 rounded-md border bg-white px-3 text-sm" />
      {!applicationId ? <input name="relatedApplicationId" placeholder="Related application ID optional" className="h-10 rounded-md border bg-white px-3 text-sm md:col-span-2" /> : null}
      <textarea name="description" placeholder="Description" rows={3} className="rounded-md border bg-white px-3 py-2 text-sm md:col-span-2" />
      {message ? (
        <div role="alert" className="md:col-span-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {message}
        </div>
      ) : null}
      <Button type="submit" disabled={busy} className="md:col-span-2">{busy ? "Saving..." : "Create Event"}</Button>
    </form>
  );
}
