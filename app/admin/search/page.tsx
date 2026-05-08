import Link from "next/link";
import { Search } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminNav } from "@/lib/adminNav";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const RESULTS_PER_GROUP = 15;

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireRole(["hr", "admin", "super_admin_hr", "executive_view_only"]);
  const { q = "" } = await searchParams;
  const query = q.trim();

  if (!query) {
    return (
      <DashboardShell user={user} nav={adminNav}>
        <Card>
          <CardHeader>
            <CardTitle>Search</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-slate-600">
            <Search size={28} className="text-orange-500" />
            <p className="text-sm">Type a name, email, application ID, or any keyword in the search bar above.</p>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const [people, applications, documents, messages, tasks] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } }
        ]
      },
      include: { applicant: { include: { applications: { select: { id: true, status: true }, take: 1, orderBy: { updatedAt: "desc" } } } } },
      take: RESULTS_PER_GROUP,
      orderBy: { createdAt: "desc" }
    }),
    prisma.application.findMany({
      where: {
        OR: [
          { id: { contains: query, mode: "insensitive" } },
          { desiredRole: { contains: query, mode: "insensitive" } },
          { applicantProfile: { user: { name: { contains: query, mode: "insensitive" } } } },
          { applicantProfile: { user: { email: { contains: query, mode: "insensitive" } } } }
        ]
      },
      include: { applicantProfile: { include: { user: true } } },
      take: RESULTS_PER_GROUP,
      orderBy: { updatedAt: "desc" }
    }),
    prisma.uploadedDocument.findMany({
      where: {
        OR: [
          { fileName: { contains: query, mode: "insensitive" } },
          { documentType: { contains: query, mode: "insensitive" } }
        ]
      },
      include: { application: { include: { applicantProfile: { include: { user: true } } } }, applicantProfile: { include: { user: true } } },
      take: RESULTS_PER_GROUP,
      orderBy: { updatedAt: "desc" }
    }),
    prisma.communicationLog.findMany({
      where: {
        OR: [
          { subject: { contains: query, mode: "insensitive" } },
          { body: { contains: query, mode: "insensitive" } }
        ]
      },
      include: { application: { include: { applicantProfile: { include: { user: true } } } } },
      take: RESULTS_PER_GROUP,
      orderBy: { createdAt: "desc" }
    }),
    prisma.task.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } }
        ]
      },
      take: RESULTS_PER_GROUP,
      orderBy: { createdAt: "desc" }
    })
  ]);

  const total = people.length + applications.length + documents.length + messages.length + tasks.length;
  await logAction(user.id, "admin_search_executed", "search", null, { query, total });

  return (
    <DashboardShell user={user} nav={adminNav}>
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Search results for &ldquo;{query}&rdquo;</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{total} match{total === 1 ? "" : "es"} across people, applications, documents, messages, and tasks.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>People ({people.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {people.length ? people.map((person) => {
              const applicationId = person.applicant?.applications[0]?.id;
              const target = applicationId ? `/admin/applications/${applicationId}/review` : "/admin/users";
              return (
                <Link key={person.id} href={target} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-slate-50 px-3 py-2 hover:border-orange-300 hover:bg-white">
                  <div>
                    <p className="font-medium text-slate-900">{person.name ?? "Unnamed"}</p>
                    <p className="text-xs text-slate-600">{person.email}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs capitalize text-slate-700">{person.role}</span>
                </Link>
              );
            }) : <p className="text-slate-500">No matching people.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Applications ({applications.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {applications.length ? applications.map((application) => (
              <Link key={application.id} href={`/admin/applications/${application.id}/review`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-slate-50 px-3 py-2 hover:border-orange-300 hover:bg-white">
                <div>
                  <p className="font-medium text-slate-900">{application.applicantProfile.user.name ?? application.applicantProfile.user.email}</p>
                  <p className="font-mono text-xs text-slate-600">{application.id}</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs capitalize text-slate-700">{application.status.replace(/_/g, " ")}</span>
              </Link>
            )) : <p className="text-slate-500">No matching applications.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Documents ({documents.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {documents.length ? documents.map((doc) => {
              const ownerUser = doc.application?.applicantProfile.user ?? doc.applicantProfile.user;
              const target = doc.applicationId ? `/admin/applications/${doc.applicationId}/review` : "/admin/applications";
              return (
                <Link key={doc.id} href={target} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-slate-50 px-3 py-2 hover:border-orange-300 hover:bg-white">
                  <div>
                    <p className="font-medium text-slate-900">{doc.fileName}</p>
                    <p className="text-xs text-slate-600">{ownerUser.name ?? ownerUser.email} &middot; {doc.documentType}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs capitalize text-slate-700">{doc.processingStatus}</span>
                </Link>
              );
            }) : <p className="text-slate-500">No matching documents.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Messages ({messages.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {messages.length ? messages.map((message) => {
              const target = message.applicationId ? `/admin/applications/${message.applicationId}?tab=messages` : "/admin/notifications";
              const ownerUser = message.application?.applicantProfile.user;
              const ownerLabel = ownerUser ? (ownerUser.name ?? ownerUser.email) : (message.recipientEmail ?? "—");
              return (
                <Link key={message.id} href={target} className="grid gap-1 rounded-md border bg-slate-50 px-3 py-2 hover:border-orange-300 hover:bg-white">
                  <p className="font-medium text-slate-900">{message.subject}</p>
                  <p className="line-clamp-2 text-xs text-slate-600">{message.body}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{ownerLabel} &middot; {message.channel}</p>
                </Link>
              );
            }) : <p className="text-slate-500">No matching messages.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tasks ({tasks.length})</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {tasks.length ? tasks.map((task) => (
              <Link key={task.id} href="/admin/tasks" className="grid gap-1 rounded-md border bg-slate-50 px-3 py-2 hover:border-orange-300 hover:bg-white">
                <p className="font-medium text-slate-900">{task.title}</p>
                {task.description ? <p className="line-clamp-2 text-xs text-slate-600">{task.description}</p> : null}
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{task.priority} &middot; {task.status}</p>
              </Link>
            )) : <p className="text-slate-500">No matching tasks.</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
