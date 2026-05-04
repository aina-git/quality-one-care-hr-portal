import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseOutcomeFromNotes } from "@/services/interview/interviewOutcomeService";

const APPLICANT_NAV = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/interview", label: "Interview" },
  { href: "/applicant/messages", label: "Messages" },
  { href: "/applicant/onboarding", label: "Onboarding" }
];

function formatDateTime(d: Date | null) {
  if (!d) return "to be confirmed";
  return d.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
}

function relativeTime(d: Date | null): string {
  if (!d) return "";
  const ms = d.getTime() - Date.now();
  const days = Math.round(ms / 86400000);
  const hours = Math.round(ms / 3600000);
  if (ms > 0) {
    if (days > 1) return `in ${days} days`;
    if (hours > 1) return `in ${hours} hours`;
    return "very soon";
  }
  if (days < -1) return `${Math.abs(days)} days ago`;
  return "earlier";
}

function stripMarkers(notes: string | null): string {
  if (!notes) return "";
  return notes
    .split("\n")
    .filter((line) => !line.startsWith("[REMINDER_") && !line.startsWith("[OUTCOME:"))
    .join("\n")
    .trim();
}

export default async function ApplicantInterviewPage() {
  const user = await requireRole(["applicant"]);
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: user.id },
    include: {
      applications: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: {
          interviewRecords: { orderBy: { scheduledAt: "asc" } }
        }
      }
    }
  });
  const application = profile?.applications[0];
  const interviews = application?.interviewRecords ?? [];
  const upcoming = interviews.filter((iv) => iv.status === "scheduled" || iv.status === "pending");
  const past = interviews.filter((iv) => iv.status === "completed" || iv.status === "cancelled");

  return (
    <DashboardShell user={user} nav={APPLICANT_NAV}>
      <div className="grid gap-5">
        <div>
          <Link href="/applicant/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Your interview</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Interview details</h1>
            <p className="mt-1 text-sm text-slate-600">When HR schedules an interview with you, it will appear here. We&apos;ll also send you reminders 24 hours and 2 hours before.</p>
          </CardContent>
        </Card>

        {interviews.length === 0 ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="p-6 text-center">
              <Calendar size={20} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600">No interview has been scheduled yet.</p>
              <p className="mt-1 text-xs text-slate-500">If HR proceeds with your application, your interview details will appear here. You&apos;ll also receive a message and (if email is configured) an email.</p>
            </CardContent>
          </Card>
        ) : null}

        {upcoming.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Upcoming</CardTitle></CardHeader>
            <CardContent className="pt-0 grid gap-3">
              {upcoming.map((iv) => (
                <div key={iv.id} className="rounded-md border border-orange-200 bg-orange-50/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-orange-700" />
                        <p className="font-semibold text-slate-900">{formatDateTime(iv.scheduledAt)}</p>
                        <span className="text-xs text-orange-700">{relativeTime(iv.scheduledAt)}</span>
                      </div>
                      {iv.location && (
                        <p className="mt-2 text-sm text-slate-700 flex items-center gap-1.5"><MapPin size={14} className="text-slate-500" /> {iv.location}</p>
                      )}
                      {stripMarkers(iv.notes) && (
                        <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{stripMarkers(iv.notes)}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">Status: <span className="font-medium capitalize">{iv.status}</span></p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {past.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Past interviews</CardTitle></CardHeader>
            <CardContent className="pt-0 grid gap-2">
              {past.map((iv) => {
                const outcome = parseOutcomeFromNotes(iv.notes);
                return (
                  <div key={iv.id} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{formatDateTime(iv.scheduledAt)}</p>
                        <p className="text-xs text-slate-500 capitalize">{iv.status}{iv.location ? ` · ${iv.location}` : ""}</p>
                      </div>
                      {outcome === "passed" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"><CheckCircle2 size={12} /> Thank you</span>}
                      {outcome === "no_show" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"><AlertCircle size={12} /> Reschedule needed</span>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-4 text-xs text-slate-700">
            <p className="font-semibold text-blue-900">Need to reschedule?</p>
            <p className="mt-1">Send a message to HR via the <Link href="/applicant/messages" className="font-medium text-orange-700 hover:underline">Messages</Link> page and we&apos;ll arrange a new time.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
