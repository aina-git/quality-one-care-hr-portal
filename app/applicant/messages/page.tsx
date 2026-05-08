import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail, MailOpen } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { buildPagination } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getLatestApplicantApplication } from "@/services/applicationService";

const APPLICANT_NAV = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/quick-upload", label: "Upload Documents" },
  { href: "/applicant/intake-review", label: "Review Extracted Fields" },
  { href: "/applicant/messages", label: "Messages" },
  { href: "/applicant/onboarding", label: "Onboarding" }
];

function relativeDay(d: Date): string {
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US");
}

export default async function ApplicantMessagesPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireRole(["applicant"]);
  const params = await searchParams;
  const { application } = await getLatestApplicantApplication(user.id);
  if (!application) redirect("/applicant/application");

  const { page, pageSize, skip, take } = buildPagination(params.page, 10, 10, 25);
  const [total, messages, unreadCount] = await Promise.all([
    prisma.applicantMessage.count({ where: { applicationId: application.id, visibleToApplicant: true } }),
    prisma.applicantMessage.findMany({
      where: { applicationId: application.id, visibleToApplicant: true },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),
    prisma.applicantMessage.count({ where: { applicationId: application.id, visibleToApplicant: true, readAt: null } })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DashboardShell user={user} nav={APPLICANT_NAV}>
      <div className="grid gap-5">
        <div>
          <Link href="/applicant/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Inbox</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Messages from HR</h1>
                <p className="mt-1 text-sm text-slate-600">Notifications about your application — corrections requested, interviews, decisions, license alerts.</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={application.status} />
                {unreadCount > 0 && <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800">{unreadCount} new</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {application.status === "correction_requested" && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-amber-900">Correction requested</p>
                <p className="text-sm text-amber-800">HR needs you to update your application. See messages below for details.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm"><Link href="/applicant/application">Update application <ArrowRight size={14} /></Link></Button>
                <Button asChild size="sm" variant="outline"><Link href="/applicant/intake-review">Review extracted fields</Link></Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Inbox</CardTitle>
            {total > 0 && <span className="text-xs font-medium text-slate-500">{total} total</span>}
          </CardHeader>
          <CardContent className="pt-0 grid gap-2">
            {messages.length === 0 ? (
              <div className="rounded-md border border-dashed bg-slate-50 p-6 text-center">
                <Mail size={20} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600">No messages yet.</p>
                <p className="mt-1 text-xs text-slate-500">When HR sends you correction requests, interview invites, or decisions, they&apos;ll appear here.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isUnread = !m.readAt;
                return (
                  <div key={m.id} className={`rounded-md border p-4 ${isUnread ? "border-orange-200 bg-orange-50/40" : "border-slate-100 bg-white"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isUnread ? <Mail size={14} className="text-orange-600 flex-shrink-0" /> : <MailOpen size={14} className="text-slate-400 flex-shrink-0" />}
                          <p className={`font-semibold ${isUnread ? "text-slate-950" : "text-slate-700"}`}>{m.subject}</p>
                          {m.senderRole === "system" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 uppercase">automated</span>}
                        </div>
                        <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{m.body}</p>
                      </div>
                      <p className="text-xs text-slate-500 flex-shrink-0">{relativeDay(m.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-100">
                <p className="text-slate-500">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" disabled={page <= 1}>
                    <Link href={page > 1 ? `/applicant/messages?page=${page - 1}` : "/applicant/messages"}>Previous</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" disabled={page >= totalPages}>
                    <Link href={page < totalPages ? `/applicant/messages?page=${page + 1}` : `/applicant/messages?page=${totalPages}`}>Next</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
