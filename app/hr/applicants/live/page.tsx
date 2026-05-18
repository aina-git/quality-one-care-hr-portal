import Link from "next/link";
import { ArrowRight, Clock, MessageSquare, UserCheck, Users } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { ShareInviteCard } from "@/components/ShareInviteCard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIntakeProgress } from "@/services/intake/intakeWizardService";

const HR_NAV = [
  { href: "/hr/dashboard", label: "Dashboard" },
  { href: "/hr/applications", label: "Applications" },
  { href: "/hr/applicants/live", label: "Live Monitor" },
  { href: "/hr/verification", label: "Verification" }
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://quality-one-care-hr-portal-production.up.railway.app";
const REGISTRATION_URL = `${APP_URL}/register`;

function ageLabel(date: Date | null | undefined) {
  if (!date) return "—";
  const ms = Date.now() - date.getTime();
  if (ms < 0) return "just now";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function activityTone(date: Date | null | undefined) {
  if (!date) return "text-slate-400";
  const ms = Date.now() - date.getTime();
  if (ms < 5 * 60_000) return "text-emerald-700"; // active in last 5 min
  if (ms < 60 * 60_000) return "text-blue-700"; // last hour
  if (ms < 24 * 60 * 60_000) return "text-slate-700"; // today
  return "text-slate-400";
}

const TERMINAL_STATUSES = ["don_approved", "approved", "don_rejected", "rejected", "final_not_approved", "completed"];

export default async function HrLiveApplicantsPage() {
  const user = await requireRole(["hr", "super_admin_hr"]);

  // Pull every application that's in flight — not draft, not terminal.
  const applications = await prisma.application.findMany({
    where: {
      AND: [
        { status: { not: "draft" } },
        { status: { notIn: TERMINAL_STATUSES as never } }
      ]
    },
    include: {
      applicantProfile: {
        include: {
          user: true,
          documents: { where: { documentType: "profile_photo" }, orderBy: { createdAt: "desc" }, take: 1 }
        }
      },
      intakeSteps: { orderBy: { updatedAt: "desc" }, take: 1 },
      validationIssues: { where: { resolved: false } }
    },
    orderBy: [{ lastActionAt: "desc" }, { updatedAt: "desc" }],
    take: 50
  });

  // Pull every applicant who registered but hasn't even started yet.
  const stillInDraft = await prisma.application.findMany({
    where: { status: "draft" },
    include: {
      applicantProfile: { include: { user: true } },
      intakeSteps: true
    },
    orderBy: { applicationCreatedAt: "desc" },
    take: 30
  });

  // Compute progress per active applicant
  const progressById = new Map<string, { completed: number; total: number; current: string | null }>();
  await Promise.all(
    applications.map(async (app) => {
      const progress = await getIntakeProgress(app.id, { desiredRole: app.desiredRole, isExistingEmployee: false }).catch(() => []);
      const completed = progress.filter((p) => p.status === "completed" || p.status === "refused").length;
      const total = progress.length;
      const inProgress = progress.find((p) => p.status === "in_progress");
      const next = inProgress ?? progress.find((p) => p.status === "not_started");
      progressById.set(app.id, {
        completed,
        total,
        current: next?.def.shortLabel ?? null
      });
    })
  );

  const activeNow = applications.filter((a) => a.lastActionAt && Date.now() - a.lastActionAt.getTime() < 5 * 60_000).length;

  return (
    <DashboardShell user={user} nav={HR_NAV}>
      <LiveRefresh intervalMs={30_000} />
      <div className="grid gap-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-orange-200/40 blur-3xl" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                <Users size={12} /> Live Applicant Monitor
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Watch applicants in real time</h1>
              <p className="mt-1 text-sm text-slate-700">
                Auto-refreshes every 30 seconds. {activeNow > 0 ? <span className="font-semibold text-emerald-800">{activeNow} active right now.</span> : "No applicants active in the last 5 minutes."}
              </p>
            </div>
          </div>
        </div>

        {/* Share invite */}
        <ShareInviteCard registrationUrl={REGISTRATION_URL} />

        {/* In progress */}
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock size={14} /> In progress ({applications.length})
          </p>
          {applications.length === 0 ? (
            <Card className="border-dashed border-slate-200">
              <CardContent className="p-6 text-center text-sm text-slate-500">
                No applicants currently in flight. Share the registration link above to start.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {applications.map((app) => {
                const progress = progressById.get(app.id);
                const percent = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
                const lastEdit = app.intakeSteps[0]?.updatedAt ?? app.lastActionAt ?? app.updatedAt;
                const tone = activityTone(lastEdit);
                return (
                  <Link key={app.id} href={`/hr/applications/${app.id}/review`} className="group block">
                    <Card className="transition hover:shadow-sm hover:border-orange-200">
                      <CardContent className="p-4">
                        <div className="flex flex-wrap items-start gap-4">
                          <ProfilePhoto document={app.applicantProfile.documents[0]} viewerUserId={user.id} name={app.applicantProfile.user.name ?? app.applicantProfile.user.email} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900">
                                {app.applicantProfile.user.name ?? app.applicantProfile.user.email}
                              </p>
                              <span className={`text-xs font-semibold tabular-nums ${tone}`}>
                                {ageLabel(lastEdit)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              {app.desiredRole ?? "Role not set"} · Status: {app.status.replace(/_/g, " ")}
                            </p>
                            {progress && progress.total > 0 && (
                              <div className="mt-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all" style={{ width: `${percent}%` }} />
                                  </div>
                                  <span className="text-xs font-medium tabular-nums text-slate-600">{progress.completed}/{progress.total}</span>
                                </div>
                                {progress.current && (
                                  <p className="mt-1 text-xs text-slate-500">Currently on: <span className="font-medium text-slate-700">{progress.current}</span></p>
                                )}
                              </div>
                            )}
                            {app.validationIssues.length > 0 && (
                              <p className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                {app.validationIssues.length} unresolved issue{app.validationIssues.length === 1 ? "" : "s"}
                              </p>
                            )}
                          </div>
                          <ArrowRight size={16} className="mt-1 flex-shrink-0 text-orange-500 transition group-hover:translate-x-0.5" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Drafts — registered but not submitted */}
        {stillInDraft.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UserCheck size={14} /> Registered but not yet submitted ({stillInDraft.length})
            </p>
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="p-4">
                <p className="text-xs text-amber-800 mb-3">
                  These applicants signed up but haven&apos;t completed their packet yet. Reach out if any have been idle too long.
                </p>
                <div className="grid gap-2">
                  {stillInDraft.map((app) => {
                    const stepCount = app.intakeSteps.filter((s) => s.status === "completed" || s.status === "refused").length;
                    return (
                      <div key={app.id} className="flex items-center justify-between rounded-md border border-amber-200 bg-white p-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{app.applicantProfile.user.name ?? app.applicantProfile.user.email}</p>
                          <p className="text-xs text-slate-600">Registered {ageLabel(app.applicationCreatedAt)} · {stepCount} step{stepCount === 1 ? "" : "s"} done</p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/hr/applications/${app.id}/review`}><MessageSquare size={12} /> Open</Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
