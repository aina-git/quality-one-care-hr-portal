import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  ShieldCheck,
  UserCircle,
  Users,
  X
} from "lucide-react";
import type { SessionUser } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { countUniqueUnreadNotifications } from "@/services/operations/notificationService";
import { APP_VERSION } from "@/lib/version";

type NavItem = {
  href: string;
  label: string;
};

const roleLabels: Record<SessionUser["role"], string> = {
  applicant: "Nurse (Portal)",
  hr: "HR Coordinator",
  hr_assistant: "HR Assistant",
  admin: "HR Coordinator",
  super_admin_hr: "HR Coordinator",
  don_approver: "Director of Nursing",
  executive_view_only: "CEO / Executive",
  scheduler_limited: "Scheduler"
};

const navIcons: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  dashboard: LayoutDashboard,
  applications: ClipboardCheck,
  applicants: Users,
  verification: ShieldCheck,
  don: ShieldCheck,
  queue: ShieldCheck,
  calendar: CalendarDays,
  tasks: CheckSquare,
  messages: MessageSquare,
  users: Users,
  onboarding: CheckSquare,
  training: ClipboardCheck,
  notifications: Bell,
  profile: UserCircle,
  about: Info
};

function iconFor(label: string, href: string) {
  const value = `${label} ${href}`.toLowerCase();
  const key = Object.keys(navIcons).find((item) => value.includes(item));
  return key ? navIcons[key] : LayoutDashboard;
}

function roleNotificationHref(role: SessionUser["role"]) {
  if (role === "super_admin_hr" || role === "admin") return "/admin/notifications";
  return "/notifications";
}

function roleCalendarHref(role: SessionUser["role"]) {
  if (role === "applicant") return "/applicant/calendar";
  if (role === "super_admin_hr" || role === "admin") return "/admin/calendar";
  if (role === "scheduler_limited") return "/scheduler/calendar";
  if (role === "hr") return "/hr/calendar";
  return "/calendar";
}

function roleTasksHref(role: SessionUser["role"]) {
  if (role === "applicant") return "/applicant/tasks";
  if (role === "super_admin_hr" || role === "admin") return "/admin/tasks";
  return "/tasks";
}

function primaryNav(user: SessionUser, provided: NavItem[]) {
  const utility: NavItem[] = [
    { href: roleNotificationHref(user.role), label: "Notifications" },
    { href: roleCalendarHref(user.role), label: "Calendar" },
    { href: roleTasksHref(user.role), label: "Tasks" }
  ];
  const merged = [...provided, ...utility];
  return merged.filter((item, index) => merged.findIndex((candidate) => candidate.href === item.href) === index);
}

function shellBackground(role: SessionUser["role"]) {
  if (role === "don_approver") return "bg-pink-50";
  if (role === "hr" || role === "super_admin_hr") return "bg-sky-50";
  if (role === "hr_assistant") return "bg-teal-50";
  return "bg-[#f7f9fb]";
}

function mainBackground(role: SessionUser["role"], nav: NavItem[]) {
  const isDonArea = role === "don_approver" || nav.some((item) => item.href.startsWith("/don"));
  if (isDonArea) return "bg-pink-50/80";
  if (role === "hr" || role === "super_admin_hr" || role === "admin" || role === "executive_view_only") return "bg-sky-50/80";
  if (role === "hr_assistant") return "bg-teal-50/80";
  return "";
}

export async function DashboardShell({
  user,
  nav,
  children
}: {
  user: SessionUser;
  nav: NavItem[];
  children: ReactNode;
}) {
  await logAction(user.id, "page_access", "route", null, { role: user.role }).catch(() => null);
  const unreadNotifications = await countUniqueUnreadNotifications(user.id).catch(() => 0);
  const dueTasks = await prisma.task.count({
    where: {
      assignedToUserId: user.id,
      status: { in: ["open", "in_progress", "overdue"] },
      dueDate: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    }
  }).catch(() => 0);
  const items = primaryNav(user, nav);
  const workspaceBackground = mainBackground(user.role, nav);
  const homeHref =
    user.role === "applicant" ? "/applicant/dashboard" :
    user.role === "hr_assistant" ? "/hr-assistant/dashboard" :
    user.role === "scheduler_limited" ? "/scheduler/dashboard" :
    user.role === "don_approver" ? "/don/approval-queue" :
    user.role === "super_admin_hr" || user.role === "admin" ? "/admin/dashboard" :
    "/hr/dashboard";
  const notificationHref = roleNotificationHref(user.role);
  const tasksHref = roleTasksHref(user.role);
  const searchHref = user.role === "super_admin_hr" || user.role === "admin" || user.role === "executive_view_only" ? "/admin/search" : null;

  return (
    <div className={cn("min-h-screen text-slate-950", shellBackground(user.role))}>
      {/* Auto-close mobile drawer when the applicant taps a sidebar link.
          Without this the checkbox stays "checked" across client-side
          Next.js navigation and the drawer stays open. Tiny inline
          listener — runs once per page load. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.addEventListener('click',function(e){var l=e.target.closest&&e.target.closest('aside a, aside button[type=submit]');if(!l)return;var t=document.getElementById('qoc-nav-toggle');if(t&&t.checked)t.checked=false;},{passive:true});`,
        }}
      />
      {/* Mobile off-canvas nav: pure-CSS drawer using a hidden checkbox.
          - Below lg: sidebar is fixed-positioned off-screen, slides in
            when the user taps the hamburger (label[for="qoc-nav-toggle"]).
          - lg and up: sidebar reverts to its original sticky column.
          A backdrop label closes the drawer on tap. */}
      <input id="qoc-nav-toggle" type="checkbox" className="peer hidden" />
      <label
        htmlFor="qoc-nav-toggle"
        className="fixed inset-0 z-30 hidden bg-slate-950/40 backdrop-blur-sm peer-checked:block lg:peer-checked:hidden"
        aria-hidden="true"
      />
      <div className="mx-auto grid max-w-[1540px] gap-6 px-3 py-3 sm:px-4 sm:py-5 lg:grid-cols-[282px_1fr]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[88vw] max-w-[320px] -translate-x-full overflow-y-auto rounded-r-3xl border-r border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)] transition-transform duration-200 peer-checked:translate-x-0",
            // Desktop reset — back to the original sticky column.
            "lg:static lg:inset-y-auto lg:z-auto lg:translate-x-0 lg:w-auto lg:max-w-none lg:overflow-visible lg:rounded-2xl lg:rounded-r-2xl lg:border lg:shadow-[0_18px_50px_rgba(15,23,42,0.08)] lg:sticky lg:top-5 lg:h-fit"
          )}
        >
          {/* Mobile-only "close drawer" affordance */}
          <label
            htmlFor="qoc-nav-toggle"
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </label>
          <div className="border-b border-slate-100 p-5">
            <Link href={homeHref} className="block rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Quality One Care</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">HR Operations Portal</p>
            </Link>
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
              <p className="text-sm font-semibold text-blue-950">{user.name ?? user.email}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-blue-700">{roleLabels[user.role]}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <Link href={notificationHref} className="qoc-card rounded-xl border border-red-100 bg-red-50 p-3 text-red-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Alerts</p>
                <Bell size={16} />
              </div>
              <p className="mt-2 text-2xl font-semibold">{unreadNotifications}</p>
            </Link>
            <Link href={tasksHref} className="qoc-card rounded-xl border border-orange-100 bg-orange-50 p-3 text-orange-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Due</p>
                <CheckSquare size={16} />
              </div>
              <p className="mt-2 text-2xl font-semibold">{dueTasks}</p>
            </Link>
          </div>
          <nav className="grid gap-1 px-3 pb-4">
            {items.map((item) => {
              const Icon = iconFor(item.label, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition",
                    "hover:bg-orange-50 hover:text-orange-700"
                  )}
                >
                  <span className="inline-flex items-center gap-3">
                    <Icon size={17} className="text-slate-400 transition group-hover:text-orange-600" />
                    {item.label}
                  </span>
                  {(item.href.endsWith("/notifications") || item.href === "/notifications") && unreadNotifications ? (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{unreadNotifications}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-slate-100 p-4 grid gap-2">
            <Link
              href="/about"
              className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-orange-700"
            >
              <span className="inline-flex items-center gap-3">
                <Info size={16} className="text-slate-400" />
                About
              </span>
              <span className="text-xs text-slate-400">v{APP_VERSION}</span>
            </Link>
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="outline" className="w-full justify-start">
                <LogOut size={16} /> Sign out
              </Button>
            </form>
          </div>
        </aside>
        <main className={cn("grid min-w-0 gap-5 rounded-3xl p-2 transition-colors sm:p-3", workspaceBackground)}>
          <div className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur sm:px-4 sm:py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Mobile-only hamburger to open the nav drawer */}
              <label
                htmlFor="qoc-nav-toggle"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </label>
              {searchHref ? (
                <form
                  action={searchHref}
                  method="get"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:max-w-xl focus-within:border-orange-300 focus-within:bg-white"
                >
                  <Search size={16} className="shrink-0 text-slate-500" />
                  <input
                    type="text"
                    name="q"
                    placeholder="Search applicants, documents, tasks, or messages"
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
                  />
                </form>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 md:max-w-xl">
                  <Search size={16} />
                  <span className="truncate">Quality One Care</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Link href={notificationHref} className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-orange-200 hover:text-orange-700">
                  <Bell size={18} />
                  {unreadNotifications ? <span className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{unreadNotifications}</span> : null}
                </Link>
                <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:block">
                  <p className="font-semibold text-slate-800">{roleLabels[user.role]}</p>
                  <p className="text-xs text-slate-500">Secure workspace</p>
                </div>
              </div>
            </div>
          </div>
          {user.role !== "applicant" && (
            <div className="qoc-fade-in rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-950">
              Machine-learning-assisted review. Final approval must be completed by the authorized DON reviewer.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
