import { DashboardShell } from "@/components/DashboardShell";
import { CreateUserForm, UserRoleControl } from "@/components/UserManagementActions";
import { UserCleanupDangerZone } from "@/components/UserCleanupDangerZone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { getUsersByRole } from "@/services/applicationService";

export default async function AdminUsersPage() {
  const user = await requireRole(["admin", "super_admin_hr"]);
  const users = await getUsersByRole();
  await logAction(user.id, "admin_users_viewed", "user", null);

  return (
    <DashboardShell
      user={user}
      nav={[
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/admin/analytics", label: "Analytics" },
        { href: "/admin/system-health", label: "System Health" },
        { href: "/admin/excel-monitor", label: "Excel Monitor" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/audit", label: "Audit" }
      ]}
    >
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-5">
            <CreateUserForm />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((portalUser) => (
                <TableRow key={portalUser.id}>
                  <TableCell>{portalUser.name ?? "Unassigned"}</TableCell>
                  <TableCell>{portalUser.email}</TableCell>
                  <TableCell className="capitalize">{portalUser.role}</TableCell>
                  <TableCell>{portalUser.isActive ? "Active" : "Inactive"}</TableCell>
                  <TableCell>{portalUser.createdAt.toLocaleDateString("en-US")}</TableCell>
                  <TableCell><UserRoleControl userId={portalUser.id} currentRole={portalUser.role} isActive={portalUser.isActive} isSelf={portalUser.id === user.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <UserCleanupDangerZone actorEmail={user.email} />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
