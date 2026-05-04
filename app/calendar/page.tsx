import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ArrowLeft, CalendarDays, Clock, MapPin, Plus, Users } from "lucide-react";
import { CalendarEventForm } from "@/components/CalendarEventForm";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types/auth";

const APPLICANT_NAV = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/messages", label: "Messages" },
  { href: "/applicant/onboarding", label: "Onboarding" }
];

const HR_NAV = [
  { href: "/hr/dashboard", label: "Dashboard" },
  { href: "/hr/applications", label: "Applications" },
  { href: "/hr/verification", label: "Verification" },
  { href: "/hr/training", label: "Training" }
];

const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/hr-review-queue", label: "HR Review Queue" },
  { href: "/admin/verification-queue", label: "Verification Queue" },
  { href: "/admin/don-approval-queue", label: "DON Approval Queue" }
];

function navFor(user: SessionUser) {
  if (user.role === "applicant") return APPLICANT_NAV;
  if (user.role === "admin" || user.role === "super_admin_hr") return ADMIN_NAV;
  return HR_NAV;
}

function eventTone(type: string) {
  if (type === "interview") return "border-orange-200 bg-orange-50 text-orange-900";
  if (type === "training") return "border-purple-200 bg-purple-50 text-purple-900";
  if (type === "onboarding") return "border-teal-200 bg-teal-50 text-teal-900";
  if (type === "license_followup" || type === "document_followup") return "border-red-200 bg-red-50 text-red-900";
  if (type === "meeting") return "border-blue-200 bg-blue-50 text-blue-900";
  if (type === "reminder") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayLabel(d: Date): string {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function timeOf(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function CalendarPage({ searchParams }: { searchParams?: Promise<{ filter?: string }> }) {
  const user = await requireAuth();
  const params = searchParams ? await searchParams : {};
  const filter = params.filter === "today" ? "today" : params.filter === "all" ? "all" : "upcoming";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const where: Prisma.CalendarEventWhereInput = {};
  if (user.role === "applicant") {
    where.OR = [
      { relatedApplicantUserId: user.id },
      { visibility: "applicant_visible", relatedApplication: { applicantProfile: { userId: user.id } } }
    ];
  } else if (user.role === "scheduler_limited") {
    where.relatedApplication = { status: "approved" };
  } else if (user.role === "executive_view_only") {
    where.visibility = { in: ["executive_visible", "applicant_visible"] };
  } else if (user.role === "don_approver") {
    where.eventType = { in: ["meeting", "reminder", "document_followup", "license_followup", "hr_task"] };
  }

  if (filter === "today") {
    where.startDateTime = { gte: todayStart, lt: todayEnd };
  } else if (filter === "upcoming") {
    where.startDateTime = { gte: todayStart };
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      relatedApplication: { include: { applicantProfile: { include: { user: true } } } },
      assignedToUser: true
    },
    orderBy: { startDateTime: "asc" },
    take: 200
  });

  const todayCount = events.filter((e) => e.startDateTime.toDateString() === now.toDateString()).length;
  const upcomingCount = events.filter((e) => e.startDateTime >= now).length;
  const canCreate = !["executive_view_only", "don_approver", "applicant"].includes(user.role);

  const grouped = new Map<string, typeof events>();
  for (const ev of events) {
    const key = dateKey(ev.startDateTime);
    const arr = grouped.get(key) ?? [];
    arr.push(ev);
    grouped.set(key, arr);
  }
  const groups = Array.from(grouped.entries()).map(([key, evs]) => ({
    date: new Date(key),
    events: evs.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())
  }));

  return (
    <DashboardShell user={user} nav={navFor(user)}>
      <div className="grid gap-5">
        <div>
          <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>

        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Calendar</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 flex items-center gap-2">
                  <CalendarDays size={20} className="text-orange-600" /> Operational schedule
                </h1>
                <p className="mt-1 text-sm text-slate-600">Interviews, onboarding, training, and follow-ups.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {[
                  { value: "today", label: "Today" },
                  { value: "upcoming", label: "Upcoming" },
                  { value: "all", label: "All" }
                ].map((opt) => (
                  <Link
                    key={opt.value}
                    href={`/calendar?filter=${opt.value}`}
                    className={`rounded-full border px-3 py-1 transition-colors ${
                      filter === opt.value
                        ? "border-orange-600 bg-orange-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-orange-300"
                    }`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 text-sm">
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Today</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{todayCount}</p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Upcoming</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{upcomingCount}</p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Visible</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{events.length}</p>
          </div>
        </div>

        {canCreate && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Plus size={16} /> New event</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <CalendarEventForm />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
          <CardContent className="pt-0 grid gap-4">
            {groups.length === 0 && (
              <div className="rounded-md border border-dashed bg-slate-50 p-6 text-center">
                <CalendarDays size={20} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600">No events {filter === "today" ? "today" : filter === "upcoming" ? "scheduled" : ""}.</p>
                {canCreate && <p className="mt-1 text-xs text-slate-500">Use the form above to create one.</p>}
              </div>
            )}
            {groups.map((group) => (
              <div key={group.date.toISOString()} className="grid gap-2">
                <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-1">{dayLabel(group.date)}</p>
                {group.events.map((ev) => (
                  <div key={ev.id} className={`rounded-md border p-3 text-sm ${eventTone(ev.eventType)}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{ev.title}</p>
                        <p className="mt-0.5 text-xs flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="inline-flex items-center gap-1"><Clock size={11} /> {timeOf(ev.startDateTime)}–{timeOf(ev.endDateTime)}</span>
                          {(ev.location || ev.meetingLink) && (
                            <span className="inline-flex items-center gap-1"><MapPin size={11} /> {ev.location ?? ev.meetingLink}</span>
                          )}
                          {ev.relatedApplication && (
                            <span className="inline-flex items-center gap-1"><Users size={11} /> {ev.relatedApplication.applicantProfile.user.name ?? ev.relatedApplication.applicantProfile.user.email}</span>
                          )}
                        </p>
                        {ev.description && <p className="mt-1 text-xs whitespace-pre-wrap opacity-90">{ev.description}</p>}
                      </div>
                      <span className="rounded-full border bg-white/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                        {ev.eventType.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
