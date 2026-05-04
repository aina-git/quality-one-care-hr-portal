import Link from "next/link";
import { Bell, CheckSquare, FileWarning, HeartPulse, MessageSquare, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { MarkAllNotificationsReadButton } from "@/components/MarkAllNotificationsReadButton";
import { OperationalPulse } from "@/components/OperationalPulse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNav } from "@/lib/adminNav";

function priorityClass(priority: string) {
  if (priority === "urgent" || priority === "high") return "border-red-200 bg-red-50 text-red-900";
  if (priority === "normal") return "border-blue-200 bg-blue-50 text-blue-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

export default async function AdminNotificationsPage() {
  const user = await requireRole(["admin", "super_admin_hr", "executive_view_only"]);
  const [notifications, systemAlerts, missingDocuments, expiringLicenses, queuedMessages, overdueTasks, readyForDon, pendingHrReviews] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: 80
    }),
    prisma.systemAlert.findMany({
      where: { resolved: false },
      include: { application: { include: { applicantProfile: { include: { user: true } } } } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 50
    }),
    prisma.application.count({ where: { status: "correction_requested" } }),
    prisma.license.count({ where: { expiresAt: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.communicationLog.count({ where: { status: "queued" } }),
    prisma.task.count({ where: { status: { in: ["open", "in_progress", "overdue"] }, dueDate: { lt: new Date() } } }),
    prisma.finalVerificationChecklist.count({ where: { status: "ready_for_don_review" } }),
    prisma.application.count({ where: { status: "hr_review_pending" } })
  ]);
  const unread = notifications.filter((item) => !item.readAt).length;
  const activeItems = [
    ...systemAlerts.map((alert) => ({
      id: `alert-${alert.id}`,
      title: alert.title,
      body: alert.message,
      priority: alert.priority,
      route: alert.route,
      createdAt: alert.createdAt,
      type: alert.category
    })),
    ...notifications.map((notification) => ({
      id: `notification-${notification.id}`,
      title: notification.title,
      body: notification.body,
      priority: notification.priority,
      route: notification.route,
      createdAt: notification.createdAt,
      type: notification.notificationType
    }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <DashboardShell user={user} nav={adminNav}>
      <div className="grid gap-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-orange-600">Super Admin Notification Center</p>
          <h1 className="mt-2 text-3xl font-semibold">Operational alerts that need attention</h1>
          <p className="mt-2 text-sm text-muted-foreground">New submissions, HR review queue items, verification problems, DON approval items, messages, licenses, and overdue work.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <MarkAllNotificationsReadButton />
            <Button asChild variant="outline"><Link href="/admin/hr-review-queue">Open HR Review Queue</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/verification-queue">Open Verification Queue</Link></Button>
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OperationalPulse label="Unread" value={unread} icon="bell" color="orange" />
          <OperationalPulse label="Pending HR Reviews" value={pendingHrReviews} icon="check" color="blue" />
          <OperationalPulse label="Missing Documents" value={missingDocuments} icon="alert" color="red" />
          <OperationalPulse label="Ready for DON" value={readyForDon} icon="check" color="green" />
          <OperationalPulse label="Expiring Licenses" value={expiringLicenses} icon="clock" color="orange" />
          <OperationalPulse label="Queued Messages" value={queuedMessages} icon="message" color="purple" />
          <OperationalPulse label="Overdue Tasks" value={overdueTasks} icon="alert" color="red" />
          <OperationalPulse label="System Alerts" value={systemAlerts.length} icon="bell" color="blue" />
        </div>
        <Card>
          <CardHeader><CardTitle>Active Notification Feed</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {activeItems.map((item) => (
              <div key={item.id} className={`rounded-xl border p-4 ${priorityClass(item.priority)}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">{item.title}</p>
                  <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-semibold uppercase">{item.type.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-2 text-sm">{item.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <span>{item.createdAt.toLocaleString()}</span>
                  {item.route ? <Link className="font-semibold underline" href={item.route.startsWith("/hr/applications") ? item.route.replace("/hr/applications", "/admin/applications") : item.route}>Open related item</Link> : null}
                </div>
              </div>
            ))}
            {!activeItems.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No active notifications at this time.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
