import type { CalendarEventType, CalendarEventVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security";
import { updateCalendarEvent } from "@/services/operations/calendarService";
import { withApi } from "@/services/monitoring/errorService";

const eventTypes = ["interview", "onboarding", "training", "license_followup", "document_followup", "hr_task", "meeting", "reminder", "other"];
const visibilities = ["internal", "applicant_visible", "executive_visible"];

function readonlyForRole(role: string) {
  return role === "executive_view_only" || role === "don_approver";
}

export const PATCH = withApi(
  { scope: "calendar.events", entityType: "calendarEvent", fallbackMessage: "Could not update calendar event." },
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth();
    if (readonlyForRole(user.role)) {
      return NextResponse.json({ error: "This role has read-only calendar access." }, { status: 403 });
    }
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const updates: Parameters<typeof updateCalendarEvent>[0] = { eventId: id, userId: user.id };

    if (typeof body.title === "string") {
      const title = sanitizeText(body.title, 200);
      if (!title) {
        return NextResponse.json({ error: "Event title is required." }, { status: 400 });
      }
      updates.title = title;
    }
    if ("description" in body) updates.description = sanitizeText(body.description, 2000);
    if ("location" in body) updates.location = sanitizeText(body.location, 500);
    if ("meetingLink" in body) updates.meetingLink = sanitizeText(body.meetingLink, 1000);

    if (body.eventType !== undefined) {
      const eventType = sanitizeText(body.eventType, 80);
      if (!eventTypes.includes(eventType)) {
        return NextResponse.json({ error: `Pick a valid event type (one of: ${eventTypes.join(", ")}).` }, { status: 400 });
      }
      updates.eventType = eventType as CalendarEventType;
    }

    if (body.visibility !== undefined) {
      const visibility = sanitizeText(body.visibility, 80);
      if (!visibilities.includes(visibility)) {
        return NextResponse.json({ error: `Pick a valid visibility (one of: ${visibilities.join(", ")}).` }, { status: 400 });
      }
      updates.visibility = visibility as CalendarEventVisibility;
    }

    let nextStart: Date | undefined;
    let nextEnd: Date | undefined;
    if (body.startDateTime !== undefined) {
      const start = new Date(String(body.startDateTime ?? ""));
      if (Number.isNaN(start.getTime())) {
        return NextResponse.json({ error: "Start date and time are required (use the date/time picker)." }, { status: 400 });
      }
      nextStart = start;
    }
    if (body.endDateTime !== undefined) {
      const end = new Date(String(body.endDateTime ?? ""));
      if (Number.isNaN(end.getTime())) {
        return NextResponse.json({ error: "End date and time are required (use the date/time picker)." }, { status: 400 });
      }
      nextEnd = end;
    }
    if (nextStart && nextEnd && nextEnd <= nextStart) {
      return NextResponse.json({ error: "End time must be after the start time." }, { status: 400 });
    }
    if (nextStart) updates.startDateTime = nextStart;
    if (nextEnd) updates.endDateTime = nextEnd;

    const event = await updateCalendarEvent(updates);
    return NextResponse.json({ event });
  }
);

export const DELETE = withApi(
  { scope: "calendar.events", entityType: "calendarEvent", fallbackMessage: "Could not delete calendar event." },
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireAuth();
    if (readonlyForRole(user.role)) {
      return NextResponse.json({ error: "This role has read-only calendar access." }, { status: 403 });
    }
    const { id } = await context.params;
    await prisma.calendarEvent.delete({ where: { id } });
    await logAction(user.id, "calendar_event_deleted", "calendar_event", id);
    return NextResponse.json({ ok: true });
  }
);
