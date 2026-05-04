import type { CalendarEventStatus, CalendarEventType, CalendarEventVisibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { createNotification } from "@/services/operations/notificationService";

export async function createCalendarEvent({
  title,
  description,
  eventType = "other",
  startDateTime,
  endDateTime,
  location,
  meetingLink,
  relatedApplicationId,
  relatedApplicantUserId,
  createdByUserId,
  assignedToUserId,
  visibility = "internal",
  reminderMinutesBefore
}: {
  title: string;
  description?: string | null;
  eventType?: CalendarEventType;
  startDateTime: Date;
  endDateTime: Date;
  location?: string | null;
  meetingLink?: string | null;
  relatedApplicationId?: string | null;
  relatedApplicantUserId?: string | null;
  createdByUserId?: string | null;
  assignedToUserId?: string | null;
  visibility?: CalendarEventVisibility;
  reminderMinutesBefore?: number | null;
}) {
  const event = await prisma.calendarEvent.create({
    data: {
      title: sanitizeText(title, 200),
      description: sanitizeText(description, 2000) || null,
      eventType,
      startDateTime,
      endDateTime,
      location: sanitizeText(location, 500) || null,
      meetingLink: sanitizeText(meetingLink, 1000) || null,
      relatedApplicationId: relatedApplicationId ?? null,
      relatedApplicantUserId: relatedApplicantUserId ?? null,
      createdByUserId: createdByUserId ?? null,
      assignedToUserId: assignedToUserId ?? null,
      visibility,
      reminderMinutesBefore: reminderMinutesBefore ?? null
    }
  });
  await logAction(createdByUserId ?? null, "calendar_event_created", "calendar_event", event.id, { eventType, visibility });
  for (const userId of [assignedToUserId, relatedApplicantUserId].filter(Boolean) as string[]) {
    await createNotification({
      userId,
      applicationId: relatedApplicationId ?? null,
      notificationType: "calendar",
      priority: eventType === "interview" ? "high" : "normal",
      title: `Calendar event: ${event.title}`,
      body: `${event.startDateTime.toLocaleString()}${event.location ? ` - ${event.location}` : ""}`,
      route: "/calendar",
      relatedCalendarEventId: event.id
    });
  }
  return event;
}

export async function updateCalendarEvent({
  eventId,
  userId,
  title,
  description,
  eventType,
  startDateTime,
  endDateTime,
  location,
  meetingLink,
  assignedToUserId,
  visibility,
  status,
  reminderMinutesBefore
}: {
  eventId: string;
  userId: string;
  title?: string;
  description?: string | null;
  eventType?: CalendarEventType;
  startDateTime?: Date;
  endDateTime?: Date;
  location?: string | null;
  meetingLink?: string | null;
  assignedToUserId?: string | null;
  visibility?: CalendarEventVisibility;
  status?: CalendarEventStatus;
  reminderMinutesBefore?: number | null;
}) {
  const event = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      title: title === undefined ? undefined : sanitizeText(title, 200),
      description: description === undefined ? undefined : sanitizeText(description, 2000) || null,
      eventType,
      startDateTime,
      endDateTime,
      location: location === undefined ? undefined : sanitizeText(location, 500) || null,
      meetingLink: meetingLink === undefined ? undefined : sanitizeText(meetingLink, 1000) || null,
      assignedToUserId: assignedToUserId === undefined ? undefined : assignedToUserId,
      visibility,
      status,
      reminderMinutesBefore: reminderMinutesBefore === undefined ? undefined : reminderMinutesBefore
    }
  });
  await logAction(userId, "calendar_event_updated", "calendar_event", eventId, { status: event.status });
  return event;
}
