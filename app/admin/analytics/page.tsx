import Link from "next/link";
import { ArrowLeft, ArrowRight, TrendingUp, AlertTriangle, Clock, Calendar, Users } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminNav } from "@/lib/adminNav";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import {
  getAdminAnalyticsData,
  getPipelineAnalytics,
  getLicenseExpirationCalendar
} from "@/services/analytics/analyticsService";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString();
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function AdminAnalyticsPage() {
  const user = await requireRole(["admin", "super_admin_hr", "executive_view_only"]);
  const [analytics, pipeline, licenseCalendar] = await Promise.all([
    getAdminAnalyticsData(),
    getPipelineAnalytics(),
    getLicenseExpirationCalendar()
  ]);
  await logAction(user.id, "admin_analytics_viewed", "dashboard", "admin_analytics");

  const maxFunnel = Math.max(...pipeline.funnel.map((s) => s.count), 1);
  const expired = licenseCalendar.filter((l) => (l.daysUntil ?? 0) < 0);
  const expiring30 = licenseCalendar.filter((l) => (l.daysUntil ?? 0) >= 0 && (l.daysUntil ?? 0) <= 30);
  const expiring60 = licenseCalendar.filter((l) => (l.daysUntil ?? 0) > 30 && (l.daysUntil ?? 0) <= 60);
  const expiring90 = licenseCalendar.filter((l) => (l.daysUntil ?? 0) > 60 && (l.daysUntil ?? 0) <= 90);

  return (
    <DashboardShell user={user} nav={adminNav}>
      <div className="grid gap-5">
        <div>
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Operational Intelligence</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 flex items-center gap-2">
              <TrendingUp size={20} className="text-orange-600" /> Pipeline & performance analytics
            </h1>
          </CardContent>
        </Card>

        {/* Top stat row */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Total applications</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{analytics.totals.applications}</p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Submitted → Interview</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{analytics.totals.submittedToInterviewRate}%</p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Interview → Approved</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{analytics.totals.interviewToApprovedRate}%</p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Avg time to decision</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{analytics.totals.averageTimeToDecisionDays}d</p>
          </div>
        </div>

        {/* Pipeline funnel */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Application pipeline funnel</CardTitle></CardHeader>
          <CardContent className="pt-0 grid gap-2">
            {pipeline.funnel.map((stage) => {
              const widthPct = Math.round((stage.count / maxFunnel) * 100);
              const tone =
                stage.stage === "Draft" ? "bg-slate-300" :
                stage.stage === "Submitted" ? "bg-blue-400" :
                stage.stage === "HR Review" ? "bg-amber-400" :
                stage.stage === "Verification" ? "bg-cyan-400" :
                stage.stage === "DON Review" ? "bg-purple-400" :
                stage.stage === "Approved" ? "bg-emerald-500" :
                "bg-red-400";
              return (
                <div key={stage.stage} className="grid grid-cols-[140px_1fr_60px] items-center gap-2 text-sm">
                  <span className="font-medium text-slate-700">{stage.stage}</span>
                  <div className="h-6 rounded bg-slate-100 overflow-hidden">
                    <div className={`h-full ${tone} transition-all`} style={{ width: `${widthPct}%` }} />
                  </div>
                  <span className="text-right font-mono font-bold text-slate-900">{stage.count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Bottleneck analysis */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /> Bottleneck analysis</CardTitle></CardHeader>
            <CardContent className="pt-0 grid gap-3 text-sm">
              <p className="text-xs text-slate-600">Applications with no activity for 2+ days, grouped by current stage.</p>
              {pipeline.stuckByStage.length === 0 ? (
                <p className="text-emerald-700">✓ No applications are currently stuck.</p>
              ) : (
                <div className="grid gap-1.5">
                  {pipeline.stuckByStage.map((s) => (
                    <div key={s.status} className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-2">
                      <span className="font-medium text-amber-900">{statusLabel(s.status)}</span>
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
              {pipeline.stuckList.length > 0 && (
                <div className="grid gap-1 mt-2 border-t border-slate-100 pt-2">
                  <p className="text-xs font-semibold text-slate-600">Most stuck applications</p>
                  {pipeline.stuckList.slice(0, 5).map((app) => (
                    <Link key={app.id} href={`/admin/applications/${app.id}/review`} className="flex items-center justify-between rounded-md border bg-white p-2 hover:border-orange-300 hover:bg-orange-50 transition-colors">
                      <div>
                        <p className="font-medium text-slate-900">{app.name}</p>
                        <p className="text-xs text-slate-500">{statusLabel(app.status)}</p>
                      </div>
                      <span className="text-xs font-bold text-red-700">{app.daysStuck}d</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top rejection reasons */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Top rejection reasons</CardTitle></CardHeader>
            <CardContent className="pt-0 grid gap-2 text-sm">
              {analytics.rejectionReasons.length === 0 ? (
                <p className="text-slate-400 italic">No rejection decisions recorded yet.</p>
              ) : (
                analytics.rejectionReasons.map((r) => {
                  const pct = Math.round((r.count / Math.max(...analytics.rejectionReasons.map((x) => x.count), 1)) * 100);
                  return (
                    <div key={r.reason} className="grid gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-slate-800">{r.reason}</p>
                        <span className="text-xs font-bold text-slate-700">{r.count}</span>
                      </div>
                      <div className="h-2 rounded bg-slate-100 overflow-hidden">
                        <div className="h-full bg-red-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* License expiration calendar */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Calendar size={16} className="text-blue-600" /> License expiration calendar (next 90 days)</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 text-sm">
              <div className="rounded-md border-2 border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-900">EXPIRED</p>
                <p className="mt-1 text-2xl font-bold text-red-900">{expired.length}</p>
                <p className="text-xs text-red-700">Action required now</p>
              </div>
              <div className="rounded-md border-2 border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-900">Next 30 days</p>
                <p className="mt-1 text-2xl font-bold text-amber-900">{expiring30.length}</p>
                <p className="text-xs text-amber-700">Schedule renewal</p>
              </div>
              <div className="rounded-md border-2 border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-semibold text-blue-900">31–60 days</p>
                <p className="mt-1 text-2xl font-bold text-blue-900">{expiring60.length}</p>
                <p className="text-xs text-blue-700">Plan ahead</p>
              </div>
              <div className="rounded-md border-2 border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">61–90 days</p>
                <p className="mt-1 text-2xl font-bold text-slate-700">{expiring90.length}</p>
                <p className="text-xs text-slate-500">Watch list</p>
              </div>
            </div>

            {(expired.length > 0 || expiring30.length > 0) && (
              <div className="mt-4 grid gap-2">
                <p className="text-xs font-semibold text-slate-600">Most urgent</p>
                {[...expired, ...expiring30].slice(0, 8).map((lic) => (
                  <Link key={lic.licenseId} href={`/admin/applications/${lic.applicationId}/review`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 p-2.5 text-sm hover:border-orange-300 hover:bg-orange-50 transition-colors">
                    <div>
                      <p className="font-medium text-slate-900">{lic.applicantName} <span className="text-slate-500">·</span> {lic.type}{lic.licenseNumber ? ` ${lic.licenseNumber}` : ""}</p>
                      <p className="text-xs text-slate-500">Expires {formatDate(lic.expiresAt)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${(lic.daysUntil ?? 0) < 0 ? "bg-red-200 text-red-900" : "bg-amber-200 text-amber-900"}`}>
                      {(lic.daysUntil ?? 0) < 0 ? `Expired ${Math.abs(lic.daysUntil ?? 0)}d ago` : `In ${lic.daysUntil}d`}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* HR performance */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Users size={16} /> HR performance</CardTitle>
            <Button asChild variant="outline" size="sm"><Link href="/api/admin/export?type=audit_logs">Export audit</Link></Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-2">
              {analytics.hrPerformance.length === 0 && <p className="text-sm text-slate-400 italic">No HR performance data yet.</p>}
              {analytics.hrPerformance.map((hr) => (
                <div key={hr.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-md border bg-white p-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{hr.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{hr.role}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Reviews</p>
                    <p className="font-bold text-slate-900">{hr.reviewsCompleted}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500"><Clock size={10} className="inline" /> Avg</p>
                    <p className="font-bold text-slate-900">{hr.averageReviewHours}h</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Decisions</p>
                    <p className="font-bold text-slate-900">{hr.decisionsMade}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 text-sm">
          <Button asChild variant="outline" size="sm"><Link href="/api/admin/export?type=applications">Export applications CSV <ArrowRight size={14} /></Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/api/admin/export?type=license_status">Export license status CSV <ArrowRight size={14} /></Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/system-health">System Health <ArrowRight size={14} /></Link></Button>
        </div>
      </div>
    </DashboardShell>
  );
}
