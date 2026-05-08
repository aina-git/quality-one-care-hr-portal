import Link from "next/link";
import type { Role } from "@prisma/client";
import { DashboardShell } from "@/components/DashboardShell";
import { CreateUserForm, UserRoleControl } from "@/components/UserManagementActions";
import { UserCleanupDangerZone } from "@/components/UserCleanupDangerZone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const APPLICANT_ROLES: Role[] = ["applicant"];
const STAFF_ROLES: Role[] = ["hr", "admin", "super_admin_hr", "don_approver", "executive_view_only", "scheduler_limited"];

const TABS = [
  { key: "applicants", label: "Applicants", roles: APPLICANT_ROLES },
  { key: "staff", label: "HR Staff", roles: STAFF_ROLES },
  { key: "all", label: "All", roles: [...APPLICANT_ROLES, ...STAFF_ROLES] }
] as const;

type TabKey = typeof TABS[number]["key"];

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["admin", "super_admin_hr"]);
  const { tab } = await searchParams;
  const activeTab: TabKey = (TABS.find((t) => t.key === tab)?.key ?? "all") as TabKey;
  const activeRoles = TABS.find((t) => t.key === activeTab)!.roles as unknown as Role[];

  const [users, applicantCount, staffCount, allCount] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: activeRoles } }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.user.count({ where: { role: { in: APPLICANT_ROLES } } }),
    prisma.user.count({ where: { role: { in: STAFF_ROLES } } }),
    prisma.user.count()
  ]);

  await logAction(user.id, "admin_users_viewed", "user", null, { tab: activeTab });

  const tabCounts: Record<TabKey, number> = { applicants: applicantCount, staff: staffCount, all: allCount };

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
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2 text-sm">
          {TABS.map((entry) => (
            <Link
              key={entry.key}
              href={`/admin/users?tab=${entry.key}`}
              className={`rounded-full border px-3 py-1 ${activeTab === entry.key ? "bg-orange-600 text-white" : "bg-white"}`}
            >
              {entry.label} ({tabCounts[entry.key]})
            </Link>
          ))}
        </div>
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
            {!users.length ? <p className="mt-3 text-sm text-muted-foreground">No users in this view.</p> : null}
            <UserCleanupDangerZone actorEmail={user.email} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
