import Link from "next/link";
import { GraduationCap, AlertTriangle, ChevronRight } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { TrainingStatusActions } from "@/components/TrainingStatusActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const HR_NAV = [
  { href: "/hr/dashboard", label: "Dashboard" },
  { href: "/hr/applications", label: "Applications" },
  { href: "/hr/verification", label: "Verification" },
  { href: "/hr/training", label: "Training" }
];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function priorityBadge(priority: string) {
  const tone =
    priority === "critical" ? "border-red-300 bg-red-100 text-red-900" :
    priority === "high" ? "border-amber-300 bg-amber-100 text-amber-900" :
    priority === "low" ? "border-slate-200 bg-slate-100 text-slate-700" :
    "border-blue-200 bg-blue-50 text-blue-800";
  return <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>{priority}</span>;
}

export default async function HrTrainingPage() {
  const user = await requireRole(["hr", "super_admin_hr", "executive_view_only"]);
  const recommendations = await prisma.trainingRecommendation.findMany({
    include: {
      application: {
        include: {
          applicantProfile: { include: { user: true, documents: { where: { documentType: "profile_photo" }, orderBy: { createdAt: "desc" }, take: 1 } } },
          employeeOnboarding: true
        }
      }
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
  });

  const isReadOnly = user.role === "executive_view_only";
  const byStatus = {
    recommended: recommendations.filter((r) => r.status === "recommended"),
    assigned: recommendations.filter((r) => r.status === "assigned"),
    completed: recommendations.filter((r) => r.status === "completed"),
    waived: recommendations.filter((r) => r.status === "waived")
  };
  const criticalRecs = recommendations.filter((r) => r.status !== "completed" && r.status !== "waived" && r.priority === "critical");

  function renderCard(rec: (typeof recommendations)[number]) {
    const applicant = rec.application.applicantProfile.user.name ?? rec.application.applicantProfile.user.email;
    return (
      <div key={rec.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-900">{rec.trainingTitle}</p>
              {priorityBadge(rec.priority)}
            </div>
            <p className="mt-1 text-xs text-slate-600">For: <Link href={`/hr/applications/${rec.applicationId}/review`} className="font-medium text-orange-700 hover:underline">{applicant}</Link></p>
            {rec.reason && <p className="mt-1 text-xs text-slate-600">{rec.reason}</p>}
            {rec.application.employeeOnboarding && (
              <Link href={`/hr/onboarding/${rec.application.employeeOnboarding.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:underline">
                Open onboarding <ChevronRight size={12} />
              </Link>
            )}
          </div>
        </div>
        {!isReadOnly && (
          <div className="mt-2">
            <TrainingStatusActions trainingId={rec.id} currentStatus={rec.status} />
          </div>
        )}
      </div>
    );
  }

  return (
    <DashboardShell user={user} nav={HR_NAV}>
      <div className="grid gap-5">
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Training</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 flex items-center gap-2">
              <GraduationCap size={20} className="text-orange-600" /> Recommended training across all applicants
            </h1>
            <p className="mt-1 text-sm text-slate-600">Auto-suggested by AI based on role, pediatric experience, certifications, and AI review findings. HR assigns and tracks completion.</p>
          </CardContent>
        </Card>

        {/* Critical priority alert */}
        {criticalRecs.length > 0 && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-700 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">{criticalRecs.length} critical training{criticalRecs.length === 1 ? "" : "s"} need attention</p>
                <p className="mt-1 text-sm text-red-800">Critical-priority items (e.g., CPR readiness) should be assigned immediately.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stat row */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border bg-white p-3 text-sm">
            <p className="text-xs font-medium text-slate-500">Recommended</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{byStatus.recommended.length}</p>
          </div>
          <div className="rounded-md border bg-white p-3 text-sm">
            <p className="text-xs font-medium text-slate-500">Assigned</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{byStatus.assigned.length}</p>
          </div>
          <div className="rounded-md border bg-white p-3 text-sm">
            <p className="text-xs font-medium text-slate-500">Completed</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{byStatus.completed.length}</p>
          </div>
          <div className="rounded-md border bg-white p-3 text-sm">
            <p className="text-xs font-medium text-slate-500">Waived</p>
            <p className="mt-1 text-2xl font-bold text-slate-700">{byStatus.waived.length}</p>
          </div>
        </div>

        {/* Kanban */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-sm font-semibold text-blue-900">Recommended</p>
              <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs font-bold text-blue-900">{byStatus.recommended.length}</span>
            </div>
            <div className="grid gap-2">
              {byStatus.recommended.length === 0 && <p className="text-xs text-slate-500 italic px-1">No new recommendations.</p>}
              {byStatus.recommended.map(renderCard)}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-sm font-semibold text-amber-900">Assigned (in progress)</p>
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">{byStatus.assigned.length}</span>
            </div>
            <div className="grid gap-2">
              {byStatus.assigned.length === 0 && <p className="text-xs text-slate-500 italic px-1">No active assignments.</p>}
              {byStatus.assigned.map(renderCard)}
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-sm font-semibold text-emerald-900">Completed</p>
              <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-900">{byStatus.completed.length}</span>
            </div>
            <div className="grid gap-2">
              {byStatus.completed.length === 0 && <p className="text-xs text-slate-500 italic px-1">No completions yet.</p>}
              {byStatus.completed.slice(0, 10).map(renderCard)}
              {byStatus.completed.length > 10 && <p className="text-xs text-slate-500 italic px-1">+ {byStatus.completed.length - 10} more</p>}
            </div>
          </div>
        </div>

        {recommendations.length === 0 && (
          <Card className="border-dashed border-slate-300">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-slate-600">No training recommendations yet.</p>
              <p className="mt-1 text-xs text-slate-500">Recommendations are auto-generated when applicants reach the verification stage and after DON approval.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
