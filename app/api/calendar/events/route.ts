import type { CalendarEventType, CalendarEventVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sanitizeText } from "@/lib/security";
import { createCalendarEvent } from "@/services/operations/calendarService";
import { withApi } from "@/services/monitoring/errorService";

const eventTypes = ["interview", "onboarding", "training", "license_followup", "document_followup", "hr_task", "meeting", "reminder", "other"];
const visibilities = ["internal", "applicant_visible", "executive_visible"];

export const POST = withApi({ scope: "calendar.events", entityType: "calendarEvent", fallbackMessage: "Could not create calendar event." }, async (request: Request) => {
  const user = await requireAuth();
  if (user.role === "executive_view_only" || user.role === "don_approver") {
    return NextResponse.json({ error: "This role has read-only calendar access." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const eventType = sanitizeText(body.eventType, 80);
  const visibility = sanitizeText(body.visibility, 80);
  const title = sanitizeText(body.title, 200);
  const start = new Date(String(body.startDateTime ?? ""));
  const end = new Date(String(body.endDateTime ?? ""));
  if (!title) {
    return NextResponse.json({ error: "Event title is required." }, { status: 400 });
  }
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Start date and time are required (use the date/time picker)." }, { status: 400 });
  }
  if (Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "End date and time are required (use the date/time picker)." }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ error: "End time must be after the start time." }, { status: 400 });
  }
  if (!eventTypes.includes(eventType)) {
    return NextResponse.json({ error: `Pick a valid event type (one of: ${eventTypes.join(", ")}).` }, { status: 400 });
  }
  if (!visibilities.includes(visibility)) {
    return NextResponse.json({ error: `Pick a valid visibility (one of: ${visibilities.join(", ")}).` }, { status: 400 });
  }

  const event = await createCalendarEvent({
    title: sanitizeText(body.title, 200),
    description: sanitizeText(body.description, 2000),
    eventType: eventType as CalendarEventType,
    startDateTime: start,
    endDateTime: end,
    location: sanitizeText(body.location, 500),
    meetingLink: sanitizeText(body.meetingLink, 1000),
    relatedApplicationId: sanitizeText(body.relatedApplicationId, 100) || null,
    relatedApplicantUserId: sanitizeText(body.relatedApplicantUserId, 100) || null,
    createdByUserId: user.id,
    assignedToUserId: sanitizeText(body.assignedToUserId, 100) || null,
    visibility: visibility as CalendarEventVisibility
  });
  return NextResponse.json({ event });
});
