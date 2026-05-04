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
    const response = await fetch("/api/calendar/events", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description"),
        eventType: form.get("eventType"),
        startDateTime: form.get("startDateTime"),
        endDateTime: form.get("endDateTime"),
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
      <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Create Event"}</Button>
      {message ? <p className="text-sm text-orange-700">{message}</p> : null}
    </form>
  );
}
