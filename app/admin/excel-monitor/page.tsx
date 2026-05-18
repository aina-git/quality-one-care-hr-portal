import { DashboardShell } from "@/components/DashboardShell";
import { ExcelCredentialMonitorPanel } from "@/components/ExcelCredentialMonitorPanel";
import { requireRole } from "@/lib/auth";

const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/system-health", label: "System Health" },
  { href: "/admin/excel-monitor", label: "Excel Monitor" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit" }
];

export default async function AdminExcelMonitorPage() {
  const user = await requireRole(["super_admin_hr"]);

  return (
    <DashboardShell user={user} nav={adminNav}>
      <ExcelCredentialMonitorPanel />
    </DashboardShell>
  );
}
