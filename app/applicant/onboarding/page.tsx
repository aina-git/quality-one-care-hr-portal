import Link from "next/link";
import { ArrowLeft, CheckCircle2, GraduationCap } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { EmployeeOnboardingTaskActions } from "@/components/EmployeeOnboardingTaskActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const APPLICANT_NAV = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/quick-upload", label: "Upload Documents" },
  { href: "/applicant/intake-review", label: "Review Extracted Fields" },
  { href: "/applicant/messages", label: "Messages" },
  { href: "/applicant/onboarding", label: "Onboarding" }
];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: Date | null) {
  if (!d) return "";
  return d.toLocaleDateString("en-US");
}

export default async function ApplicantOnboardingPage() {
  const user = await requireRole(["applicant"]);
  const application = await prisma.application.findFirst({
    where: { applicantProfile: { userId: user.id } },
    orderBy: { updatedAt: "desc" },
    include: {
      employeeOnboarding: { include: { tasks: { orderBy: { createdAt: "asc" } } } },
      trainingRecommendations: { orderBy: [{ priority: "desc" }, { createdAt: "asc" }] }
    }
  });
  const onboarding = application?.employeeOnboarding;
  const tasks = onboarding?.tasks ?? [];
  const completedCount = tasks.filter((t) => t.status !== "pending").length;
  const progressPct = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const trainingItems = application?.trainingRecommendations ?? [];

  return (
    <DashboardShell user={user} nav={APPLICANT_NAV}>
      <div className="grid gap-5">
        <div>
          <Link href="/applicant/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>

        <Card className="border-slate-200">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Welcome to Quality One Care</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Your Onboarding</h1>
            {onboarding && tasks.length > 0 && (
              <div className="mt-4 grid gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">{completedCount} of {tasks.length} tasks complete</span>
                  <span className="font-semibold text-orange-700">{progressPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-orange-500 transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!onboarding ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-slate-600">Your onboarding will start after the DON approves your application.</p>
              <p className="mt-1 text-xs text-slate-500">Once approved, you&apos;ll see tasks here including: Employee Manual review, Compliance Training, Pediatric Care Training, KanTime Training, and any required onboarding documents.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">Onboarding Tasks</CardTitle>
              <span className="text-xs font-medium text-slate-500">{tasks.length} item{tasks.length === 1 ? "" : "s"}</span>
            </CardHeader>
            <CardContent className="pt-0 grid gap-3">
              {tasks.length === 0 && <p className="text-sm text-slate-400 italic">No tasks assigned yet.</p>}
              {tasks.map((task) => {
                const isDone = task.status !== "pending";
                return (
                  <div key={task.id} className={`rounded-md border p-4 ${isDone ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isDone && <CheckCircle2 size={16} className="text-emerald-600" />}
                          <p className="font-semibold text-slate-900">{task.title}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                            task.status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
                            task.status === "waived" ? "border-slate-200 bg-slate-100 text-slate-700" :
                            "border-amber-200 bg-amber-50 text-amber-800"
                          }`}>{label(task.status)}</span>
                        </div>
                        {task.description && <p className="mt-1 text-sm text-slate-700">{task.description}</p>}
                        {task.dueDate && <p className="mt-1 text-xs text-slate-500">Due {formatDate(task.dueDate)}</p>}
                      </div>
                      <div className="flex-shrink-0">
                        <EmployeeOnboardingTaskActions taskId={task.id} currentStatus={task.status} mode="applicant" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {trainingItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><GraduationCap size={16} /> Recommended Training</CardTitle></CardHeader>
            <CardContent className="pt-0 grid gap-2">
              {trainingItems.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{item.trainingTitle}</p>
                      {item.reason && <p className="mt-1 text-slate-600">{item.reason}</p>}
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      item.priority === "critical" || item.priority === "high" ? "border-red-200 bg-red-50 text-red-800" :
                      item.priority === "normal" ? "border-blue-200 bg-blue-50 text-blue-800" :
                      "border-slate-200 bg-slate-100 text-slate-700"
                    }`}>{label(item.priority)} priority</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Status: {label(item.status)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
