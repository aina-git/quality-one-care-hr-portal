import Link from "next/link";
import { ArrowRight, AlertTriangle, Clock, ShieldCheck, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { AlertPriorityBadge } from "@/components/AlertPriorityBadge";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPhase5HrMetrics } from "@/services/dashboard/phase5MetricsService";
import { repairHrReviewWorkflowIntegrity } from "@/services/workflow/hrReviewQueueService";
import { outcomeColorFor, colorClasses } from "@/lib/outcomeColor";

const HR_NAV = [
  { href: "/hr/dashboard", label: "Dashboard" },
  { href: "/hr/applications", label: "Applications" },
  { href: "/hr/verification", label: "Verification" },
  { href: "/hr/training", label: "Training" }
];

function ageDays(date: Date | null | undefined) {
  if (!date) return null;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  return days;
}

function ageLabel(date: Date | null | undefined) {
  const days = ageDays(date);
  if (days === null) return "—";
  if (days <= 0) return "Today";
  return `${days}d ago`;
}

function bottleneck(status: string, lastActionAt: Date | null) {
  const days = ageDays(lastActionAt) ?? 0;
  if (status === "draft" && days > 3) return { label: "Draft stuck", tone: "amber" };
  if (status === "correction_requested" && days > 2) return { label: "Correction overdue", tone: "amber" };
  if (status === "submitted" && days > 1) return { label: "Review overdue", tone: "red" };
  if (days > 7) return { label: "Stage aging", tone: "amber" };
  return { label: "On track", tone: "green" };
}

export default async function HrDashboardPage() {
  const user = await requireRole(["hr", "admin", "super_admin_hr", "don_approver", "executive_view_only"]);
  if (!["don_approver", "executive_view_only"].includes(user.role)) {
    await repairHrReviewWorkflowIntegrity(user.id);
  }

  const [
    phase5Metrics,
    pendingHrReview,
    hrReviewStarted,
    verificationInProgress,
    readyForDonReview,
    correctionRequested,
    expiredVerificationItems,
    overdueApplications,
    reviewQueueRows,
    recentApplications
  ] = await Promise.all([
    getPhase5HrMetrics(),
    prisma.application.count({ where: { status: "hr_review_pending" } }),
    prisma.application.count({ where: { status: "hr_review_started" } }),
    prisma.application.count({ where: { status: { in: ["verification_pending", "verification_in_progress"] } } }),
    prisma.application.count({ where: { status: { in: ["ready_for_don_review", "don_review", "don_review_started"] } } }),
    prisma.application.count({ where: { status: "correction_requested" } }),
    prisma.verificationChecklistItem.count({ where: { OR: [{ status: "expired" }, { expirationDate: { lt: new Date() } }] } }),
    prisma.application.count({ where: { status: { in: ["hr_review_pending", "hr_review_started", "correction_requested"] }, lastActionAt: { lt: new Date(Date.now() - 2 * 86400000) } } }),
    prisma.application.findMany({
      where: { status: { in: ["hr_review_pending", "hr_review_started"] } },
      include: {
        applicantProfile: {
          include: {
            user: true,
            documents: { where: { documentType: "profile_photo" }, orderBy: { createdAt: "desc" }, take: 1 }
          }
        },
        validationIssues: { where: { resolved: false, issueType: { in: ["missing", "analysis_failed", "low_confidence"] } } }
      },
      orderBy: [{ status: "asc" }, { applicationSubmittedAt: "desc" }],
      take: 8
    }),
    prisma.application.findMany({
      where: { status: { not: "draft" } },
      include: {
        applicantProfile: {
          include: {
            user: true,
            documents: { where: { documentType: "profile_photo" }, orderBy: { createdAt: "desc" }, take: 1 }
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8
    })
  ]);

  const isReadOnly = user.role === "executive_view_only";

  return (
    <DashboardShell user={user} nav={HR_NAV}>
      <div className="grid gap-5">

        {/* HEADER */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">HR Dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Today&apos;s work</h1>
            <p className="mt-1 text-sm text-slate-600">{isReadOnly ? "Read-only operational view." : "Pick up applications waiting for HR action."}</p>
          </CardContent>
        </Card>

        {/* TODAY'S WORK — 4 big action queue cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/hr/applications?status=hr_review_pending" className="group rounded-xl border-2 border-red-200 bg-red-50 p-5 transition-colors hover:border-red-400">
            <div className="flex items-start justify-between gap-2">
              <UserCheck size={20} className="text-red-700" />
              <ArrowRight size={16} className="text-red-700 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-3 text-3xl font-bold text-red-900">{pendingHrReview}</p>
            <p className="mt-1 text-sm font-semibold text-red-900">Pending HR Review</p>
            <p className="text-xs text-red-700">{pendingHrReview === 1 ? "applicant waiting" : "applicants waiting"}</p>
          </Link>

          <Link href="/hr/applications?status=hr_review_started" className="group rounded-xl border-2 border-amber-200 bg-amber-50 p-5 transition-colors hover:border-amber-400">
            <div className="flex items-start justify-between gap-2">
              <Clock size={20} className="text-amber-700" />
              <ArrowRight size={16} className="text-amber-700 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-3 text-3xl font-bold text-amber-900">{hrReviewStarted}</p>
            <p className="mt-1 text-sm font-semibold text-amber-900">In HR Review</p>
            <p className="text-xs text-amber-700">started, not closed</p>
          </Link>

          <Link href="/hr/applications?status=verification_in_progress" className="group rounded-xl border-2 border-blue-200 bg-blue-50 p-5 transition-colors hover:border-blue-400">
            <div className="flex items-start justify-between gap-2">
              <ShieldCheck size={20} className="text-blue-700" />
              <ArrowRight size={16} className="text-blue-700 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-3 text-3xl font-bold text-blue-900">{verificationInProgress}</p>
            <p className="mt-1 text-sm font-semibold text-blue-900">Verification</p>
            <p className="text-xs text-blue-700">credential checks</p>
          </Link>

          <Link href="/hr/applications?status=ready_for_don_review" className="group rounded-xl border-2 border-purple-200 bg-purple-50 p-5 transition-colors hover:border-purple-400">
            <div className="flex items-start justify-between gap-2">
              <ShieldCheck size={20} className="text-purple-700" />
              <ArrowRight size={16} className="text-purple-700 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-3 text-3xl font-bold text-purple-900">{readyForDonReview}</p>
            <p className="mt-1 text-sm font-semibold text-purple-900">Awaiting DON</p>
            <p className="text-xs text-purple-700">final approval</p>
          </Link>
        </div>

        {/* Secondary stats — single row */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Correction requested</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{correctionRequested}</p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Overdue (&gt;2d no action)</p>
            <p className={`mt-1 text-xl font-semibold ${overdueApplications > 0 ? "text-red-700" : "text-slate-900"}`}>{overdueApplications}</p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Expired credentials</p>
            <p className={`mt-1 text-xl font-semibold ${expiredVerificationItems > 0 ? "text-red-700" : "text-slate-900"}`}>{expiredVerificationItems}</p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Open license alerts</p>
            <p className={`mt-1 text-xl font-semibold ${phase5Metrics.openLicenseAlerts > 0 ? "text-amber-700" : "text-slate-900"}`}>{phase5Metrics.openLicenseAlerts}</p>
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">

          {/* LEFT — Active queue */}
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">HR Review Queue</CardTitle>
              <Button asChild variant="outline" size="sm"><Link href="/hr/applications">All applications</Link></Button>
            </CardHeader>
            <CardContent className="pt-0">
              {reviewQueueRows.length === 0 ? (
                <p className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-slate-600 text-center">No applications waiting for HR review. 🎉</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewQueueRows.map((app) => {
                      const color = outcomeColorFor(app.status);
                      const cls = colorClasses(color);
                      return (
                      <TableRow key={app.id} className={color !== "neutral" ? cls.bg : undefined}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls.dot}`} aria-hidden />
                            <ProfilePhoto document={app.applicantProfile.documents[0]} viewerUserId={user.id} name={app.applicantProfile.user.name ?? app.applicantProfile.user.email} size="sm" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900">{app.applicantProfile.user.name ?? app.applicantProfile.user.email}</p>
                              <p className="text-xs text-slate-500">{app.desiredRole ?? "—"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={app.status} /></TableCell>
                        <TableCell className="text-sm text-slate-700">{ageLabel(app.applicationSubmittedAt ?? app.submittedAt)}</TableCell>
                        <TableCell>{app.validationIssues.length > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{app.validationIssues.length}</span> : <span className="text-xs text-slate-400">none</span>}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm">
                            <Link href={app.status === "hr_review_pending" ? `/hr/applications/${app.id}/open-review` : `/hr/applications/${app.id}/review`}>Open <ArrowRight size={14} /></Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* RIGHT — Alerts + recent activity */}
          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /> Operational alerts</CardTitle></CardHeader>
              <CardContent className="pt-0 grid gap-2 text-sm">
                {phase5Metrics.activeAlerts.length === 0 && <p className="text-slate-400 italic">No active alerts.</p>}
                {phase5Metrics.activeAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertPriorityBadge priority={alert.priority} />
                      <p className="font-semibold text-slate-900">{alert.title}</p>
                    </div>
                    <p className="mt-1 text-slate-700">{alert.message}</p>
                    {alert.route && <Link href={alert.route} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:underline">Open <ArrowRight size={12} /></Link>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
              <CardContent className="pt-0 grid gap-2 text-sm">
                {recentApplications.slice(0, 6).map((app) => {
                  const bn = bottleneck(app.status, app.lastActionAt);
                  const toneClass = bn.tone === "red" ? "text-red-700" : bn.tone === "amber" ? "text-amber-700" : "text-emerald-700";
                  return (
                    <Link key={app.id} href={`/hr/applications/${app.id}/review`} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-2.5 hover:border-orange-300 hover:bg-orange-50 transition-colors">
                      <ProfilePhoto document={app.applicantProfile.documents[0]} viewerUserId={user.id} name={app.applicantProfile.user.name ?? app.applicantProfile.user.email} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{app.applicantProfile.user.name ?? app.applicantProfile.user.email}</p>
                        <p className="text-xs text-slate-500">{app.status.replace(/_/g, " ")} · {ageLabel(app.lastActionAt ?? app.updatedAt)}</p>
                      </div>
                      <span className={`text-xs font-semibold ${toneClass}`}>{bn.label}</span>
                    </Link>
                  );
                })}
                {recentApplications.length === 0 && <p className="text-slate-400 italic">No recent applications.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
