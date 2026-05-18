import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ArrowLeft, CheckSquare, Clock, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { TaskForm } from "@/components/TaskForm";
import { TaskStatusActions } from "@/components/TaskStatusActions";
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

const DON_NAV = [
  { href: "/don/approval-queue", label: "DON Queue" }
];

const ASSISTANT_NAV = [
  { href: "/hr-assistant/dashboard", label: "Dashboard" },
  { href: "/hr-assistant/applications", label: "Applications" }
];

const SCHEDULER_NAV = [
  { href: "/scheduler/dashboard", label: "Dashboard" }
];

function navFor(user: SessionUser) {
  if (user.role === "applicant") return APPLICANT_NAV;
  if (user.role === "super_admin_hr" || user.role === "admin") return ADMIN_NAV;
  if (user.role === "don_approver") return DON_NAV;
  if (user.role === "hr_assistant") return ASSISTANT_NAV;
  if (user.role === "scheduler_limited") return SCHEDULER_NAV;
  if (user.role === "executive_view_only") return ADMIN_NAV;
  return HR_NAV;
}

function priorityBadge(priority: string) {
  const tone =
    priority === "urgent" ? "border-red-300 bg-red-100 text-red-900" :
    priority === "high" ? "border-amber-300 bg-amber-100 text-amber-900" :
    priority === "low" ? "border-slate-200 bg-slate-100 text-slate-700" :
    "border-blue-200 bg-blue-50 text-blue-800";
  return <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>{priority}</span>;
}

function dueLabel(due: Date | null, status: string): { text: string; tone: string } {
  if (!due) return { text: "No due date", tone: "text-slate-500" };
  const ms = due.getTime() - Date.now();
  const days = Math.round(ms / 86400000);
  if (status === "completed") return { text: `Done · was due ${due.toLocaleDateString("en-US")}`, tone: "text-slate-500" };
  if (ms < 0) return { text: `${Math.abs(days)}d overdue`, tone: "text-red-700 font-semibold" };
  if (days === 0) return { text: "Due today", tone: "text-amber-700 font-semibold" };
  if (days === 1) return { text: "Due tomorrow", tone: "text-amber-700" };
  if (days < 7) return { text: `Due in ${days}d`, tone: "text-slate-700" };
  return { text: `Due ${due.toLocaleDateString("en-US")}`, tone: "text-slate-500" };
}

export default async function TasksPage() {
  const user = await requireAuth();
  const where: Prisma.TaskWhereInput = {};
  if (user.role === "applicant") {
    where.OR = [{ assignedToUserId: user.id }, { relatedApplicantUserId: user.id }];
  } else if (user.role === "scheduler_limited") {
    where.relatedApplication = { status: "approved" };
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      relatedApplication: { include: { applicantProfile: { include: { user: true } } } },
      assignedToUser: true
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 200
  });

  const now = new Date();
  const open = tasks.filter((t) => t.status === "open" && (!t.dueDate || t.dueDate >= now));
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const overdue = tasks.filter((t) => t.status !== "completed" && t.dueDate && t.dueDate < now);
  const completed = tasks.filter((t) => t.status === "completed");

  const canCreate = user.role !== "executive_view_only" && user.role !== "don_approver";
  const isReadOnly = user.role === "executive_view_only";

  function renderCard(task: (typeof tasks)[number]) {
    const due = dueLabel(task.dueDate, task.status);
    const applicant = task.relatedApplication?.applicantProfile.user.name ?? task.relatedApplication?.applicantProfile.user.email;
    return (
      <div key={task.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-900">{task.title}</p>
              {priorityBadge(task.priority)}
            </div>
            {task.description && <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap line-clamp-3">{task.description}</p>}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
              <span className={due.tone}>{due.text}</span>
              {applicant && (
                <Link href={`/hr/applications/${task.relatedApplicationId}/review`} className="text-orange-700 hover:underline">
                  {applicant}
                </Link>
              )}
            </div>
          </div>
        </div>
        {!isReadOnly && (
          <div className="mt-2">
            <TaskStatusActions taskId={task.id} />
          </div>
        )}
      </div>
    );
  }

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
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Tasks</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 flex items-center gap-2">
              <CheckSquare size={20} className="text-orange-600" /> Work queue
            </h1>
            <p className="mt-1 text-sm text-slate-600">Your assigned tasks plus follow-ups created by the workflow.</p>
          </CardContent>
        </Card>

        {overdue.length > 0 && (
          <Link href="#overdue-column" className="block">
            <Card className="border-red-300 bg-red-50 transition hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-700 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">{overdue.length} overdue task{overdue.length === 1 ? "" : "s"}</p>
                  <p className="mt-1 text-sm text-red-800">These are blocking the workflow — close them first.</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 text-sm">
          <Link href="#open-column" className="rounded-md border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-medium text-slate-500">Open</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{open.length}</p>
          </Link>
          <Link href="#open-column" className="rounded-md border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-medium text-slate-500">In progress</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{inProgress.length}</p>
          </Link>
          <Link href="#overdue-column" className="rounded-md border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-medium text-slate-500">Overdue</p>
            <p className={`mt-1 text-2xl font-bold ${overdue.length > 0 ? "text-red-700" : "text-slate-900"}`}>{overdue.length}</p>
          </Link>
          <Link href="#completed-column" className="rounded-md border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-medium text-slate-500">Completed</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{completed.length}</p>
          </Link>
        </div>

        {canCreate && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Plus size={16} /> New task</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <TaskForm />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <div id="overdue-column" className="rounded-lg border border-red-200 bg-red-50/30 p-3 scroll-mt-20">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-sm font-semibold text-red-900 flex items-center gap-1.5"><AlertTriangle size={14} /> Overdue</p>
              <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-bold text-red-900">{overdue.length}</span>
            </div>
            <div className="grid gap-2">
              {overdue.length === 0 && <p className="text-xs text-slate-500 italic px-1">No overdue tasks. ✓</p>}
              {overdue.map(renderCard)}
            </div>
          </div>

          <div id="open-column" className="rounded-lg border border-blue-200 bg-blue-50/30 p-3 scroll-mt-20">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-sm font-semibold text-blue-900 flex items-center gap-1.5"><Clock size={14} /> Open / In Progress</p>
              <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs font-bold text-blue-900">{open.length + inProgress.length}</span>
            </div>
            <div className="grid gap-2">
              {open.length + inProgress.length === 0 && <p className="text-xs text-slate-500 italic px-1">No active tasks.</p>}
              {[...inProgress, ...open].map(renderCard)}
            </div>
          </div>

          <div id="completed-column" className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3 scroll-mt-20">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5"><CheckCircle2 size={14} /> Completed</p>
              <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-900">{completed.length}</span>
            </div>
            <div className="grid gap-2">
              {completed.length === 0 && <p className="text-xs text-slate-500 italic px-1">Nothing done yet.</p>}
              {completed.slice(0, 10).map(renderCard)}
              {completed.length > 10 && <p className="text-xs text-slate-500 italic px-1">+ {completed.length - 10} more</p>}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
