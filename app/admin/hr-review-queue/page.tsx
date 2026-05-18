import Link from "next/link";
import type { ApplicationStatus } from "@prisma/client";
import { DashboardShell } from "@/components/DashboardShell";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminNav } from "@/lib/adminNav";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { repairHrReviewWorkflowIntegrity } from "@/services/workflow/hrReviewQueueService";

const reviewStatuses: ApplicationStatus[] = ["hr_review_pending", "hr_review_started", "submitted", "under_review"];
const waitingStatuses: ApplicationStatus[] = ["hr_review_pending", "submitted"];
const startedStatuses: ApplicationStatus[] = ["hr_review_started", "under_review"];

const TABS = [
  { key: "pending", label: "Pending", statuses: waitingStatuses },
  { key: "started", label: "Started", statuses: startedStatuses },
  { key: "all", label: "All", statuses: reviewStatuses }
] as const;

type TabKey = typeof TABS[number]["key"];

function formatDate(date?: Date | null) {
  return date ? date.toLocaleString("en-US") : "Not recorded";
}

function actionHref(applicationId: string, status: ApplicationStatus) {
  return waitingStatuses.includes(status)
    ? `/admin/applications/${applicationId}/open-review`
    : `/admin/applications/${applicationId}/review`;
}

function actionLabel(status: ApplicationStatus) {
  return waitingStatuses.includes(status) ? "Start HR Review" : "Open Review";
}

export default async function AdminHrReviewQueuePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["super_admin_hr"]);
  const { tab } = await searchParams;
  const activeTab: TabKey = (TABS.find((t) => t.key === tab)?.key ?? "pending") as TabKey;
  const activeStatuses = TABS.find((t) => t.key === activeTab)!.statuses as unknown as ApplicationStatus[];

  await repairHrReviewWorkflowIntegrity(user.id);

  const applications = await prisma.application.findMany({
    where: { status: { in: activeStatuses } },
    include: {
      applicantProfile: { include: { user: true } },
      documents: { select: { id: true, documentType: true, processingStatus: true, detectedDocumentType: true } },
      hrReviewQueue: true,
      tasks: {
        where: {
          category: "application_review",
          status: { in: ["open", "in_progress", "overdue"] }
        },
        orderBy: { createdAt: "desc" },
        take: 1
      },
      validationIssues: {
        where: {
          resolved: false,
          issueType: { in: ["missing", "low_confidence", "analysis_failed", "mismatch"] }
        },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: [{ applicationSubmittedAt: "desc" }, { updatedAt: "desc" }],
    take: 100
  });

  const [waitingCount, startedCount] = await Promise.all([
    prisma.application.count({ where: { status: { in: waitingStatuses } } }),
    prisma.application.count({ where: { status: { in: startedStatuses } } })
  ]);
  const unresolvedIssueCount = applications.reduce((total, application) => total + application.validationIssues.length, 0);
  const withDocumentsCount = applications.filter((application) => application.documents.length > 0).length;
  const tabCounts: Record<TabKey, number> = { pending: waitingCount, started: startedCount, all: waitingCount + startedCount };

  return (
    <DashboardShell user={user} nav={adminNav}>
      <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-orange-50 p-7 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-600">Super Admin Work Queue</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Applications Needing HR Review</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
              This page now reads directly from application workflow status and repairs missing queue records when it loads.
              A submitted applicant should never be invisible to Super Admin or HR.
            </p>
          </div>
          <div className="rounded-2xl border border-white bg-white/80 p-4 text-sm shadow-sm">
            <div className="font-semibold text-slate-950">Queue health</div>
            <div className="mt-1 text-slate-600">{applications.length} active review application{applications.length === 1 ? "" : "s"}</div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        {TABS.map((entry) => (
          <Link
            key={entry.key}
            href={`/admin/hr-review-queue?tab=${entry.key}`}
            className={`rounded-full border px-3 py-1 ${activeTab === entry.key ? "bg-orange-600 text-white" : "bg-white"}`}
          >
            {entry.label} ({tabCounts[entry.key]})
          </Link>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Waiting for HR Review" value={waitingCount} href="/admin/hr-review-queue?tab=pending" />
        <MetricCard label="HR Review Started" value={startedCount} href="/admin/hr-review-queue?tab=started" />
        <MetricCard label="Missing or Unclear Items" value={unresolvedIssueCount} href="/admin/hr-review-queue?tab=all" />
        <MetricCard label="With Uploaded Documents" value={withDocumentsCount} href="/admin/applications" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {applications.map((application) => {
          const applicant = application.applicantProfile.user;
          const applicantName = applicant.name ?? applicant.email;
          const queueStatus = application.hrReviewQueue?.status ?? "auto-repaired pending";
          const latestTask = application.tasks[0];
          const submittedAt = application.applicationSubmittedAt ?? application.submittedAt;
          const lastActivityAt = application.hrReviewQueue?.lastActivityAt ?? application.lastActionAt ?? application.updatedAt;

          return (
            <Card key={application.id} className="qoc-card overflow-hidden rounded-2xl border-blue-100 transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
              <CardHeader className="border-b bg-white">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-xl text-slate-950">{applicantName}</CardTitle>
                    <p className="mt-1 text-sm text-slate-600">{applicant.email}</p>
                    <p className="mt-2 font-mono text-xs text-slate-500">{application.id}</p>
                  </div>
                  <StatusBadge status={application.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Submitted</div>
                    <div className="mt-1 text-sm font-medium text-slate-950">{formatDate(submittedAt)}</div>
                  </div>
                  <div className="rounded-xl border border-orange-100 bg-orange-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">Issues</div>
                    <div className="mt-1 text-2xl font-bold text-slate-950">{application.validationIssues.length}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Documents</div>
                    <div className="mt-1 text-2xl font-bold text-slate-950">{application.documents.length}</div>
                  </div>
                </div>

                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <div>
                    <div className="font-semibold text-slate-950">Queue status</div>
                    <div className="capitalize text-slate-600">{queueStatus}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-950">Review task</div>
                    <div className="capitalize text-slate-600">{latestTask?.status ?? "No open task"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-950">Last activity</div>
                    <div className="text-slate-600">{formatDate(lastActivityAt)}</div>
                  </div>
                </div>

                {application.validationIssues.length ? (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <div className="text-sm font-semibold text-orange-900">Top item needing attention</div>
                    <div className="mt-1 text-sm text-orange-800">{application.validationIssues[0].message}</div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                    No unresolved missing or low-confidence intake issues are currently attached.
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={actionHref(application.id, application.status)}>{actionLabel(application.status)}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/admin/applications/${application.id}/verification`}>Open Verification</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/admin/applications/${application.id}/review`}>Review Report</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>All Active HR Review Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell>
                    <div className="font-medium">{application.applicantProfile.user.name ?? application.applicantProfile.user.email}</div>
                    <div className="font-mono text-xs text-muted-foreground">{application.id}</div>
                  </TableCell>
                  <TableCell><StatusBadge status={application.status} /></TableCell>
                  <TableCell>{formatDate(application.applicationSubmittedAt ?? application.submittedAt)}</TableCell>
                  <TableCell>{application.documents.length}</TableCell>
                  <TableCell>{application.validationIssues.length}</TableCell>
                  <TableCell className="capitalize">{application.hrReviewQueue?.status ?? "pending"}</TableCell>
                  <TableCell>
                    <Button asChild size="sm">
                      <Link href={actionHref(application.id, application.status)}>{actionLabel(application.status)}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!applications.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <h2 className="text-lg font-semibold text-slate-950">No active HR review applications right now.</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
                I checked the workflow statuses directly. Draft applications are intentionally excluded here, but submitted
                or HR-review applications will appear immediately.
              </p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/admin/applications">View all applications</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
