import Link from "next/link";
import { MarkAllNotificationsReadButton } from "@/components/MarkAllNotificationsReadButton";
import { OperationalPulse } from "@/components/OperationalPulse";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listGroupedNotifications } from "@/services/operations/notificationService";

function color(priority: string) {
  if (priority === "urgent") return "border-red-200 bg-red-50 text-red-800";
  if (priority === "high") return "border-orange-200 bg-orange-50 text-orange-800";
  if (priority === "normal") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireAuth();
  const params = await searchParams;
  const filter = params.filter ?? "all";
  void prisma;
  let groups = await listGroupedNotifications(user.id, { take: 200 });
  if (filter === "unread") groups = groups.filter((g) => g.unreadCount > 0);
  if (filter === "urgent") groups = groups.filter((g) => g.priority === "urgent" || g.priority === "high");
  if (filter === "messages") groups = groups.filter((g) => g.notificationType === "message");
  if (filter === "reminders") groups = groups.filter((g) => g.notificationType === "reminder");
  const notifications = groups.slice(0, 100);
  const unread = groups.filter((g) => g.unreadCount > 0).length;

  return (
    <DashboardShell user={user} nav={[]}>
      <div className="grid gap-6">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-orange-600">Notification Center</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Alerts, reminders, and messages</h1>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {["all", "urgent", "unread", "messages", "reminders", "system_alerts"].map((item) => (
              <Link key={item} href={`/notifications?filter=${item}`} className={`rounded-full border px-3 py-1 capitalize ${filter === item ? "bg-orange-600 text-white" : "bg-white"}`}>{item.replace(/_/g, " ")}</Link>
            ))}
            <MarkAllNotificationsReadButton />
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-3">
          <OperationalPulse label="Unread" value={unread} icon="bell" color="orange" href="/notifications?filter=unread" />
          <OperationalPulse label="Urgent/High" value={notifications.filter((g) => g.priority === "urgent" || g.priority === "high").length} icon="alert" color="red" href="/notifications?filter=urgent" />
          <OperationalPulse label="Messages" value={notifications.filter((g) => g.notificationType === "message").length} icon="message" color="blue" href="/notifications?filter=messages" />
        </div>
        <Card>
          <CardHeader><CardTitle>Activity Feed</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {notifications.map((g) => {
              const card = (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {g.title}
                      {g.duplicateCount > 1 ? <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-700">×{g.duplicateCount}</span> : null}
                    </p>
                    <span className="text-xs uppercase">{g.unreadCount > 0 ? "unread" : "read"} - {g.notificationType.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-1 text-sm">{g.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span>{g.createdAt.toLocaleString("en-US")}</span>
                    {g.duplicateCount > 1 ? <span className="text-slate-600">{g.unreadCount} unread of {g.duplicateCount} repeats</span> : null}
                    {g.route ? <span className="underline">Open related item</span> : null}
                  </div>
                </>
              );
              if (g.route) {
                return (
                  <Link key={g.representativeId} href={g.route} className={`block rounded-md border p-3 transition hover:-translate-y-0.5 hover:shadow-md ${color(g.priority)}`}>
                    {card}
                  </Link>
                );
              }
              return (
                <div key={g.representativeId} className={`rounded-md border p-3 ${color(g.priority)}`}>
                  {card}
                </div>
              );
            })}
            {!notifications.length ? <p className="text-sm text-muted-foreground">No notifications match this filter.</p> : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
