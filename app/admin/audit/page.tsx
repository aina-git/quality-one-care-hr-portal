import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { buildPagination, sanitizeText } from "@/lib/security";
import { prisma } from "@/lib/prisma";

export default async function AdminAuditPage({
  searchParams
}: {
  searchParams: Promise<{ user?: string; action?: string; from?: string; to?: string; page?: string }>;
}) {
  const user = await requireRole(["admin"]);
  const params = await searchParams;
  const userFilter = sanitizeText(params.user, 80);
  const actionFilter = sanitizeText(params.action, 80);
  const dateFrom = params.from ? new Date(params.from) : null;
  const dateTo = params.to ? new Date(params.to) : null;
  const { page, pageSize, skip, take } = buildPagination(params.page, 20, 20, 50);

  const where = {
    user: userFilter ? { email: { contains: userFilter, mode: "insensitive" as const } } : undefined,
    action: actionFilter ? { contains: actionFilter, mode: "insensitive" as const } : undefined,
    createdAt: {
      gte: dateFrom && !Number.isNaN(dateFrom.getTime()) ? dateFrom : undefined,
      lte: dateTo && !Number.isNaN(dateTo.getTime()) ? new Date(dateTo.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined
    }
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip,
      take
    })
  ]);
  await logAction(user.id, "admin_audit_viewed", "audit_log", null, { filters: { userFilter, actionFilter, page } });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = new URLSearchParams();
  if (userFilter) baseParams.set("user", userFilter);
  if (actionFilter) baseParams.set("action", actionFilter);
  if (params.from) baseParams.set("from", params.from);
  if (params.to) baseParams.set("to", params.to);

  function pageHref(nextPage: number) {
    const query = new URLSearchParams(baseParams);
    query.set("page", String(nextPage));
    return `/admin/audit?${query.toString()}`;
  }

  return (
    <DashboardShell
      user={user}
      nav={[
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/admin/analytics", label: "Analytics" },
        { href: "/admin/system-health", label: "System Health" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/audit", label: "Audit" }
      ]}
    >
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-5" action="/admin/audit">
            <input name="user" defaultValue={userFilter} placeholder="User email" className="h-10 rounded-md border bg-white px-3 text-sm" />
            <input name="action" defaultValue={actionFilter} placeholder="Action" className="h-10 rounded-md border bg-white px-3 text-sm" />
            <input name="from" type="date" defaultValue={params.from ?? ""} className="h-10 rounded-md border bg-white px-3 text-sm" />
            <input name="to" type="date" defaultValue={params.to ?? ""} className="h-10 rounded-md border bg-white px-3 text-sm" />
            <div className="flex items-end gap-2">
              <Button type="submit">Filter</Button>
              <Button asChild type="button" variant="outline"><Link href="/admin/audit">Reset</Link></Button>
            </div>
          </form>

          {logs.length === 0 ? (
            <div className="rounded-md border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
              No audit logs matched the selected filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.createdAt.toLocaleString("en-US")}</TableCell>
                    <TableCell>{entry.user?.email ?? "System"}</TableCell>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell>{entry.entityType}{entry.entityId ? `:${entry.entityId}` : ""}</TableCell>
                    <TableCell>{entry.requestPath ?? "-"}</TableCell>
                    <TableCell>{entry.ipAddress ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" disabled={page <= 1}>
                <Link href={page > 1 ? pageHref(page - 1) : "#"}>Previous</Link>
              </Button>
              <Button asChild size="sm" variant="outline" disabled={page >= totalPages}>
                <Link href={page < totalPages ? pageHref(page + 1) : "#"}>Next</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
