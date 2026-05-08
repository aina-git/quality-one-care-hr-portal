import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function valueLabel(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "-";
}

function detailsRole(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  const role = (details as Record<string, unknown>).role;
  return typeof role === "string" ? role : "";
}

export default async function LogReviewPage({
  searchParams
}: {
  searchParams: Promise<{
    user?: string;
    applicant?: string;
    phone?: string;
    action?: string;
    role?: string;
    from?: string;
    to?: string;
    failed?: string;
  }>;
}) {
  const user = await requireRole(["admin", "super_admin_hr"]);
  const filters = await searchParams;
  const where: Prisma.AuditLogWhereInput = {};
  if (filters.user) {
    where.user = {
      OR: [
        { email: { contains: filters.user, mode: "insensitive" } },
        { name: { contains: filters.user, mode: "insensitive" } }
      ]
    };
  }
  if (filters.action) where.action = { contains: filters.action, mode: "insensitive" };
  if (filters.from || filters.to) {
    where.createdAt = {
      gte: filters.from ? new Date(filters.from) : undefined,
      lte: filters.to ? new Date(`${filters.to}T23:59:59`) : undefined
    };
  }
  if (filters.applicant) {
    const applications = await prisma.application.findMany({
      where: {
        applicantProfile: {
          user: {
            OR: [
              { email: { contains: filters.applicant, mode: "insensitive" } },
              { name: { contains: filters.applicant, mode: "insensitive" } }
            ]
          }
        }
      },
      select: { id: true, applicantProfileId: true }
    });
    const ids = applications.flatMap((application) => [application.id, application.applicantProfileId]);
    where.OR = [
      { entityId: { in: ids } },
      { details: { path: ["applicationId"], string_contains: applications[0]?.id ?? "__none__" } as never }
    ];
  }

  const rawLogs = await prisma.auditLog.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 300
  });
  const logs = rawLogs.filter((log) => {
    if (filters.role && log.user?.role !== filters.role && detailsRole(log.details) !== filters.role) return false;
    if (filters.phone && !JSON.stringify(log.details ?? {}).includes(filters.phone.replace(/\D/g, "").slice(-4))) return false;
    if (filters.failed && !/failed|rate_limited|login_failed/i.test(log.action)) return false;
    return true;
  });
  const repeatedLoginAttempts = logs.filter((log) => log.action === "auth.login_failed").length;
  const pageAccessByUser = new Map<string, number>();
  for (const log of logs.filter((entry) => entry.action === "page_access")) {
    const key = log.user?.email ?? log.ipAddress ?? "unknown";
    pageAccessByUser.set(key, (pageAccessByUser.get(key) ?? 0) + 1);
  }
  const unusualAccess = [...pageAccessByUser.entries()].filter(([, count]) => count > 50);
  const excessiveEdits = logs.filter((log) => /updated|edited|decision|verification_item_updated|workflow_/i.test(log.action)).length;
  const recoveryActivity = logs.filter((log) => log.action.startsWith("password_recovery") || log.action === "password_reset_completed").length;
  const applicationTimeline = logs.filter((log) => log.entityType === "application" || String(log.details ?? "").includes("applicationId")).slice(0, 80);

  return (
    <DashboardShell user={user} nav={[
      { href: "/admin/dashboard", label: "Dashboard" },
      { href: "/admin/audit", label: "Audit" },
      { href: "/hr/log-review", label: "Log Review" },
      { href: "/hr/applications", label: "Applications" }
    ]}>
      <div className="grid gap-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-orange-600">Super HR / Admin Only</p>
          <h1 className="mt-2 text-3xl font-semibold">Security and lifecycle log review</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Review login activity, route access, application lifecycle events, document intake, verification activity, messages, and DON decisions.
          </p>
        </section>

        <Card>
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent>
            <form action="/hr/log-review" className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <input name="user" defaultValue={filters.user ?? ""} placeholder="User name/email" className="h-10 rounded-md border bg-white px-3 text-sm" />
              <input name="applicant" defaultValue={filters.applicant ?? ""} placeholder="Applicant name/email" className="h-10 rounded-md border bg-white px-3 text-sm" />
              <input name="phone" defaultValue={filters.phone ?? ""} placeholder="Phone ending" className="h-10 rounded-md border bg-white px-3 text-sm" />
              <input name="action" defaultValue={filters.action ?? ""} placeholder="Action type" className="h-10 rounded-md border bg-white px-3 text-sm" />
              <select name="role" defaultValue={filters.role ?? ""} className="h-10 rounded-md border bg-white px-3 text-sm">
                <option value="">All roles</option>
                {["applicant", "hr", "admin", "super_admin_hr", "don_approver", "executive_view_only", "scheduler_limited"].map((role) => <option key={role} value={role}>{valueLabel(role)}</option>)}
              </select>
              <input name="from" defaultValue={filters.from ?? ""} type="date" className="h-10 rounded-md border bg-white px-3 text-sm" />
              <input name="to" defaultValue={filters.to ?? ""} type="date" className="h-10 rounded-md border bg-white px-3 text-sm" />
              <label className="flex h-10 items-center gap-2 rounded-md border bg-white px-3 text-sm">
                <input name="failed" value="1" defaultChecked={filters.failed === "1"} type="checkbox" />
                Failed attempts
              </label>
              <Button type="submit">Apply Filters</Button>
              <Button asChild type="button" variant="outline"><Link href="/hr/log-review">Reset</Link></Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-red-200 bg-red-50"><CardHeader><CardTitle>Repeated Login Attempts</CardTitle></CardHeader><CardContent className="text-3xl font-semibold text-red-900">{repeatedLoginAttempts}</CardContent></Card>
          <Card className="border-orange-200 bg-orange-50"><CardHeader><CardTitle>Unusual Access Patterns</CardTitle></CardHeader><CardContent className="text-3xl font-semibold text-orange-900">{unusualAccess.length}</CardContent></Card>
          <Card className="border-purple-200 bg-purple-50"><CardHeader><CardTitle>Excessive Edits / Decisions</CardTitle></CardHeader><CardContent className="text-3xl font-semibold text-purple-900">{excessiveEdits}</CardContent></Card>
          <Card className="border-blue-200 bg-blue-50"><CardHeader><CardTitle>Password Recovery Activity</CardTitle></CardHeader><CardContent className="text-3xl font-semibold text-blue-900">{recoveryActivity}</CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Application Activity Timeline</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {applicationTimeline.map((log) => (
              <div key={log.id} className="rounded-xl border bg-slate-50 p-3">
                <p className="font-semibold">{log.action}</p>
                <p className="text-xs text-slate-500">{log.createdAt.toLocaleString("en-US")} - {log.user?.email ?? "System"} - {log.requestPath ?? "-"}</p>
              </div>
            ))}
            {!applicationTimeline.length ? <p className="text-muted-foreground">No application activity found for the selected filters.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Raw Audit Events</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>IP / Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.createdAt.toLocaleString("en-US")}</TableCell>
                    <TableCell>{log.user?.email ?? "System"}</TableCell>
                    <TableCell>{valueLabel(log.user?.role ?? detailsRole(log.details))}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.requestPath ?? "-"}</TableCell>
                    <TableCell>{log.entityType}:{log.entityId ?? "-"}</TableCell>
                    <TableCell className="max-w-64 truncate">{log.ipAddress ?? "-"} / {log.userAgent ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
