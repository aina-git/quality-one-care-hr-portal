import Link from "next/link";
import { ArrowRight, ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { outcomeColorFor, colorClasses, colorLabel, stageLabel } from "@/lib/outcomeColor";

const DON_NAV = [
  { href: "/don/approval-queue", label: "DON Queue" },
  { href: "/admin/dashboard", label: "Operations" }
];

function ageLabel(d: Date | null) {
  if (!d) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "Today";
  return `${days}d ago`;
}

export default async function DonApprovalQueuePage() {
  const user = await requireRole(["super_admin_hr", "don_approver", "executive_view_only"]);

  const apps = await prisma.application.findMany({
    where: {
      status: { in: ["verification_passed", "ready_for_don_review", "rejected"] }
    },
    include: {
      applicantProfile: {
        include: {
          user: true,
          documents: { where: { documentType: "profile_photo" }, orderBy: { createdAt: "desc" }, take: 1 }
        }
      },
      licenses: { take: 1 },
      decisions: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: { submittedToDonAt: "desc" },
    take: 50
  });

  const green = apps.filter((a) => outcomeColorFor(a.status) === "green");
  const amber = apps.filter((a) => outcomeColorFor(a.status) === "amber");
  const red = apps.filter((a) => outcomeColorFor(a.status) === "red");

  function renderRow(app: (typeof apps)[number]) {
    const color = outcomeColorFor(app.status);
    const cls = colorClasses(color);
    const lic = app.licenses[0];
    return (
      <Link
        key={app.id}
        href={`/don/final-approval/${app.id}`}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 ${cls.border} ${cls.bg} p-4 transition-colors hover:opacity-90`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className={`inline-block h-3 w-3 rounded-full ${cls.dot} flex-shrink-0`} />
          <ProfilePhoto document={app.applicantProfile.documents[0]} viewerUserId={user.id} name={app.applicantProfile.user.name ?? app.applicantProfile.user.email} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{app.applicantProfile.user.name ?? app.applicantProfile.user.email}</p>
            <p className="text-xs text-slate-600">
              {app.desiredRole ?? "Role not recorded"}
              {lic && <> · {lic.type}{lic.licenseNumber ? ` ${lic.licenseNumber}` : ""}</>}
              <span className="mx-1.5">·</span>
              HR: {ageLabel(app.submittedToDonAt ?? app.lastActionAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls.pill}`}>{colorLabel(color).toUpperCase()}</span>
          <ArrowRight size={16} className="text-slate-400" />
        </div>
      </Link>
    );
  }

  return (
    <DashboardShell user={user} nav={DON_NAV}>
      <div className="grid gap-5">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">DON Final Approval Dashboard</div>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-pink-700">DON Final Approval Queue</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Cases awaiting your decision</h1>
            <p className="mt-1 text-sm text-slate-600">All applicants HR has finished reviewing. You make the final call.</p>
          </CardContent>
        </Card>

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-700" /><p className="font-semibold text-emerald-900">PASS</p></div>
            <p className="mt-2 text-3xl font-bold text-emerald-900">{green.length}</p>
            <p className="text-xs text-emerald-700">HR cleared. Confirm to proceed to onboarding.</p>
          </div>
          <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2"><AlertTriangle size={18} className="text-amber-700" /><p className="font-semibold text-amber-900">NEEDS FINAL APPROVAL</p></div>
            <p className="mt-2 text-3xl font-bold text-amber-900">{amber.length}</p>
            <p className="text-xs text-amber-700">HR wants your second look.</p>
          </div>
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2"><XCircle size={18} className="text-red-700" /><p className="font-semibold text-red-900">FAIL</p></div>
            <p className="mt-2 text-3xl font-bold text-red-900">{red.length}</p>
            <p className="text-xs text-red-700">HR-level fail. Confirm or override.</p>
          </div>
        </div>

        {amber.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle size={16} className="text-amber-700" /> Needs final approval ({amber.length})</CardTitle></CardHeader>
            <CardContent className="pt-0 grid gap-2">{amber.map(renderRow)}</CardContent>
          </Card>
        )}

        {green.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-700" /> HR pass — confirm onboarding ({green.length})</CardTitle></CardHeader>
            <CardContent className="pt-0 grid gap-2">{green.map(renderRow)}</CardContent>
          </Card>
        )}

        {red.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><XCircle size={16} className="text-red-700" /> Failed at HR — confirm or override ({red.length})</CardTitle></CardHeader>
            <CardContent className="pt-0 grid gap-2">{red.map(renderRow)}</CardContent>
          </Card>
        )}

        {apps.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-slate-600">No applications are awaiting your decision.</p>
              <p className="mt-1 text-xs text-slate-500">Cases appear here after HR records an outcome (pass / needs final approval / fail).</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
