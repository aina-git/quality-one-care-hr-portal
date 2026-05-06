import { DashboardShell } from "@/components/DashboardShell";
import { AdminIntakeWizard } from "@/components/AdminIntakeWizard";
import { adminNav } from "@/lib/adminNav";
import { requireRole } from "@/lib/auth";

export default async function AdminNewApplicationPage() {
  const user = await requireRole(["admin", "super_admin_hr"]);
  return (
    <DashboardShell user={user} nav={adminNav}>
      <AdminIntakeWizard />
    </DashboardShell>
  );
}
