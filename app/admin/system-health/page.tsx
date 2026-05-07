import Link from "next/link";
import { AlertPriorityBadge } from "@/components/AlertPriorityBadge";
import { DashboardShell } from "@/components/DashboardShell";
import { JobRunControls } from "@/components/JobRunControls";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { getSystemHealthData } from "@/services/analytics/analyticsService";

const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/system-health", label: "System Health" },
  { href: "/admin/excel-monitor", label: "Excel Monitor" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit" }
];

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
  return `${Math.round(value / 1024 / 102.4) / 10} MB`;
}

export default async function AdminSystemHealthPage() {
  const user = await requireRole(["admin"]);
  const health = await getSystemHealthData();
  await logAction(user.id, "admin_system_health_viewed", "dashboard", "system_health");

  return (
    <DashboardShell user={user} nav={adminNav}>
      <div className="grid gap-6">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-orange-600">System Health</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Background jobs and operational readiness</h1>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Failed Job Runs" value={health.failedRuns} />
          <MetricCard label="Queued Messages" value={health.queueStatus.queued} />
          <MetricCard label="Failed Messages" value={health.queueStatus.failed} />
          <MetricCard label="Storage Usage" value={formatBytes(health.storage.totalBytes)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Job Runner Status</CardTitle>
              <JobRunControls />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Last Status</TableHead>
                    <TableHead>Last Completed</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {health.jobs.map((job) => (
                    <TableRow key={job.key}>
                      <TableCell>{job.name}</TableCell>
                      <TableCell>{job.scheduleLabel}</TableCell>
                      <TableCell className="capitalize">{job.lastStatus.replace(/_/g, " ")}</TableCell>
                      <TableCell>{job.lastCompletedAt ? job.lastCompletedAt.toLocaleString("en-US") : "Not yet"}</TableCell>
                      <TableCell>{job.nextRunAt ? job.nextRunAt.toLocaleString("en-US") : "Pending"}</TableCell>
                      <TableCell><JobRunControls jobKey={job.key} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Queue and Storage</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="/api/admin/export?type=onboarding_status">Export Onboarding</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="rounded-md border bg-slate-50 p-3">
                <p className="font-medium">Email Queue</p>
                <p>Queued: {health.queueStatus.queued}</p>
                <p>Sent: {health.queueStatus.sent}</p>
                <p>Failed: {health.queueStatus.failed}</p>
              </div>
              <div className="rounded-md border bg-slate-50 p-3">
                <p className="font-medium">Protected Storage</p>
                <p>Provider: {health.storage.provider}</p>
                <p>Files: {health.storage.fileCount}</p>
                <p>Usage: {formatBytes(health.storage.totalBytes)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Prioritized Alerts</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {health.alerts.length ? health.alerts.map((alert) => (
              <div key={alert.id} className="rounded-md border bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertPriorityBadge priority={alert.priority} />
                  <p className="font-medium">{alert.title}</p>
                </div>
                <p className="mt-2 text-slate-700">{alert.message}</p>
                {alert.route ? (
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href={alert.route}>Open Related Record</Link>
                  </Button>
                ) : null}
              </div>
            )) : <p className="text-muted-foreground">No active system alerts.</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
