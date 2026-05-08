"use client";

import type { CalendarEventType, CalendarEventVisibility } from "@prisma/client";
import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const eventTypes: CalendarEventType[] = ["interview", "onboarding", "training", "license_followup", "document_followup", "hr_task", "meeting", "reminder", "other"];
const visibilities: CalendarEventVisibility[] = ["internal", "applicant_visible", "executive_visible"];

type EditableEvent = {
  id: string;
  title: string;
  description: string | null;
  eventType: CalendarEventType;
  startDateTime: string;
  endDateTime: string;
  location: string | null;
  meetingLink: string | null;
  visibility: CalendarEventVisibility;
};

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CalendarEventActions({ event }: { event: EditableEvent }) {
  const [mode, setMode] = useState<"idle" | "editing">("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submitEdit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const startStr = String(form.get("startDateTime") ?? "");
    const endStr = String(form.get("endDateTime") ?? "");
    if (!title) {
      setMessage("Title is required.");
      return;
    }
    if (!startStr || !endStr) {
      setMessage("Start and end times are required.");
      return;
    }
    if (new Date(endStr) <= new Date(startStr)) {
      setMessage("End time must be after the start time.");
      return;
    }
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/calendar/events/${event.id}`, {
      method: "PATCH",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        title,
        description: String(form.get("description") ?? ""),
        eventType: String(form.get("eventType") ?? event.eventType),
        startDateTime: new Date(startStr).toISOString(),
        endDateTime: new Date(endStr).toISOString(),
        location: String(form.get("location") ?? ""),
        meetingLink: String(form.get("meetingLink") ?? ""),
        visibility: String(form.get("visibility") ?? event.visibility)
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Could not save changes.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  async function handleDelete() {
    const ok = window.confirm(`Delete "${event.title}"? This cannot be undone.`);
    if (!ok) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/calendar/events/${event.id}`, {
      method: "DELETE",
      headers: getCsrfHeaders()
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Could not delete event.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  if (mode === "idle") {
    return (
      <div className="mt-3 flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setMode("editing")} disabled={busy}>
          <Pencil size={14} /> Edit
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDelete} disabled={busy}>
          <Trash2 size={14} /> Delete
        </Button>
        {message ? <p className="text-xs text-red-700">{message}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={submitEdit} className="mt-3 grid gap-2 rounded-md border bg-white/80 p-3 md:grid-cols-2">
      <input
        name="title"
        defaultValue={event.title}
        required
        placeholder="Event title"
        className="h-9 rounded-md border bg-white px-3 text-sm md:col-span-2"
      />
      <select name="eventType" defaultValue={event.eventType} className="h-9 rounded-md border bg-white px-3 text-sm">
        {eventTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
      </select>
      <select name="visibility" defaultValue={event.visibility} className="h-9 rounded-md border bg-white px-3 text-sm">
        {visibilities.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
      </select>
      <input
        name="startDateTime"
        type="datetime-local"
        defaultValue={toLocalInputValue(event.startDateTime)}
        required
        className="h-9 rounded-md border bg-white px-3 text-sm"
      />
      <input
        name="endDateTime"
        type="datetime-local"
        defaultValue={toLocalInputValue(event.endDateTime)}
        required
        className="h-9 rounded-md border bg-white px-3 text-sm"
      />
      <input
        name="location"
        defaultValue={event.location ?? ""}
        placeholder="Location"
        className="h-9 rounded-md border bg-white px-3 text-sm"
      />
      <input
        name="meetingLink"
        defaultValue={event.meetingLink ?? ""}
        placeholder="Meeting link"
        className="h-9 rounded-md border bg-white px-3 text-sm"
      />
      <textarea
        name="description"
        defaultValue={event.description ?? ""}
        placeholder="Description"
        rows={2}
        className="rounded-md border bg-white px-3 py-1.5 text-sm md:col-span-2"
      />
      {message ? (
        <p role="alert" className="md:col-span-2 text-sm text-red-700">{message}</p>
      ) : null}
      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving..." : "Save changes"}</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => { setMode("idle"); setMessage(""); }} disabled={busy}>
          <X size={14} /> Cancel
        </Button>
      </div>
    </form>
  );
}
