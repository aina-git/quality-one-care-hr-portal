import Link from "next/link";
import { MarkAllNotificationsReadButton } from "@/components/MarkAllNotificationsReadButton";
import { OperationalPulse } from "@/components/OperationalPulse";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(filter === "unread" ? { readAt: null } : {}),
      ...(filter === "urgent" ? { priority: { in: ["urgent", "high"] } } : {}),
      ...(filter === "messages" ? { notificationType: "message" } : {}),
      ...(filter === "reminders" ? { notificationType: "reminder" } : {})
    },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 100
  });
  const unread = notifications.filter((item) => !item.readAt).length;

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
          <OperationalPulse label="Unread" value={unread} icon="bell" color="orange" />
          <OperationalPulse label="Urgent/High" value={notifications.filter((item) => ["urgent", "high"].includes(item.priority)).length} icon="alert" color="red" />
          <OperationalPulse label="Messages" value={notifications.filter((item) => item.notificationType === "message").length} icon="message" color="blue" />
        </div>
        <Card>
          <CardHeader><CardTitle>Activity Feed</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {notifications.map((item) => (
              <div key={item.id} className={`rounded-md border p-3 ${color(item.priority)}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{item.title}</p>
                  <span className="text-xs uppercase">{item.readAt ? "read" : "unread"} - {item.notificationType.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-1 text-sm">{item.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <span>{item.createdAt.toLocaleString()}</span>
                  {item.route ? <Link className="underline" href={item.route}>Open related item</Link> : null}
                </div>
              </div>
            ))}
            {!notifications.length ? <p className="text-sm text-muted-foreground">No notifications match this filter.</p> : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
