import type { SessionUser } from "@/types/auth";

export type NavItem = { href: string; label: string };

export const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/intake-locations", label: "Intake Locations" },
  { href: "/admin/hr-review-queue", label: "HR Review Queue" },
  { href: "/admin/verification-queue", label: "Verification Queue" },
  { href: "/admin/don-approval-queue", label: "DON Approval Queue" },
  { href: "/admin/verification-providers", label: "Verification Providers" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/system-health", label: "System Health" },
  { href: "/admin/excel-monitor", label: "Excel Monitor" },
  { href: "/admin/analysis-settings", label: "Analysis Settings" }
];

export const hrNav: NavItem[] = [
  { href: "/hr/dashboard", label: "Dashboard" },
  { href: "/hr/applications", label: "Applications" },
  { href: "/hr/applicants/live", label: "Live Monitor" },
  { href: "/hr/verification", label: "Verification" },
  { href: "/hr/training", label: "Training" },
  { href: "/hr/log-review", label: "Log Review" }
];

export const applicantNav: NavItem[] = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/intake", label: "Intake" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/quick-upload", label: "Quick Upload" },
  { href: "/applicant/messages", label: "Messages" },
  { href: "/applicant/onboarding", label: "Onboarding" },
  { href: "/applicant/progress", label: "Progress" }
];

export const donNav: NavItem[] = [
  { href: "/don/approval-queue", label: "Approval Queue" }
];

export const schedulerNav: NavItem[] = [
  { href: "/scheduler/dashboard", label: "Dashboard" },
  { href: "/scheduler/calendar", label: "Calendar" },
  { href: "/tasks", label: "Tasks" }
];

export const executiveNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/system-health", label: "System Health" }
];

export function navForRole(role: SessionUser["role"]): NavItem[] {
  if (role === "admin" || role === "super_admin_hr") return adminNav;
  if (role === "hr") return hrNav;
  if (role === "applicant") return applicantNav;
  if (role === "don_approver") return donNav;
  if (role === "scheduler_limited") return schedulerNav;
  if (role === "executive_view_only") return executiveNav;
  return [];
}
