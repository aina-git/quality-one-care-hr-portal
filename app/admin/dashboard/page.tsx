import { DashboardShell } from "@/components/DashboardShell";
import { MetricCard } from "@/components/MetricCard";
import { OperationalPulse } from "@/components/OperationalPulse";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNav } from "@/lib/adminNav";
import { getAdminMetrics } from "@/services/applicationService";
import { repairHrReviewWorkflowIntegrity } from "@/services/workflow/hrReviewQueueService";

export default async function AdminDashboardPage() {
  const user = await requireRole(["admin", "super_admin_hr", "executive_view_only"]);
  if (user.role !== "executive_view_only") {
    await repairHrReviewWorkflowIntegrity(user.id);
  }
  const metrics = await getAdminMetrics();
  const [
    donApprovalQueue,
    totalVerificationChecklists,
    readyOrApprovedVerificationChecklists,
    unreadNotifications,
    overdueTasks,
    todayEvents,
    queuedMessages,
    criticalAlerts,
    pendingHrReview,
    hrReviewStarted,
    verificationPending,
    verificationInProgress,
    readyForDonReview,
    missingDocumentsRequested,
    overdueApplications,
    reviewQueueRows
  ] = await Promise.all([
    prisma.finalVerificationChecklist.count({ where: { status: "ready_for_don_review" } }),
    prisma.finalVerificationChecklist.count(),
    prisma.finalVerificationChecklist.count({ where: { status: { in: ["ready_for_don_review", "approved_by_don"] } } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.task.count({ where: { status: { in: ["open", "in_progress", "overdue"] }, dueDate: { lt: new Date() } } }),
    prisma.calendarEvent.count({
      where: {
        startDateTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        endDateTime: { lte: new Date(new Date().setHours(23, 59, 59, 999)) }
      }
    }),
    prisma.communicationLog.count({ where: { status: "queued" } }),
    prisma.systemAlert.count({ where: { resolved: false, priority: { in: ["critical", "high"] } } }),
    prisma.application.count({ where: { status: "hr_review_pending" } }),
    prisma.application.count({ where: { status: "hr_review_started" } }),
    prisma.application.count({ where: { status: "verification_pending" } }),
    prisma.application.count({ where: { status: "verification_in_progress" } }),
    prisma.application.count({ where: { status: "ready_for_don_review" } }),
    prisma.application.count({ where: { status: "correction_requested" } }),
    prisma.application.count({
      where: {
        status: { in: ["hr_review_pending", "hr_review_started", "verification_pending", "verification_in_progress", "correction_requested"] },
        lastActionAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
      }
    }),
    prisma.application.findMany({
      where: { status: { in: ["hr_review_pending", "hr_review_started"] } },
      include: {
        applicantProfile: { include: { user: true } },
        validationIssues: { where: { resolved: false, issueType: { in: ["missing", "analysis_failed", "low_confidence"] } } },
        hrReviewQueue: true
      },
      orderBy: [{ status: "asc" }, { applicationSubmittedAt: "desc" }, { updatedAt: "desc" }],
      take: 8
    })
  ]);
  const verificationCompletionRate = totalVerificationChecklists
    ? `${Math.round((readyOrApprovedVerificationChecklists / totalVerificationChecklists) * 100)}%`
    : "0%";
  await logAction(user.id, "admin_dashboard_viewed", "dashboard", "admin");

  return (
    <DashboardShell
      user={user}
      nav={user.role === "executive_view_only" ? adminNav.filter((item) => item.href !== "/admin/users") : adminNav}
    >
      <div className="grid gap-6">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Admin Verification Dashboard</div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-950 p-6 text-white">
            <p className="text-sm font-medium text-orange-300">Admin Command Center</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">Quality One Care operations cockpit</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">Control users, tasks, reminders, calendar events, verification queues, communications, and compliance activity from one operational surface.</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <a href="/admin/tasks" className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-900 hover:bg-orange-100">
              <p className="text-sm font-medium">Create or review tasks</p>
              <p className="mt-1 text-xs">Assign work, close overdue items, and track ownership.</p>
            </a>
            <a href="/admin/calendar" className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900 hover:bg-blue-100">
              <p className="text-sm font-medium">Open calendar</p>
              <p className="mt-1 text-xs">Schedule interviews, onboarding, training, and follow-ups.</p>
            </a>
            <a href="/admin/notifications" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 hover:bg-red-100">
              <p className="text-sm font-medium">Notification center</p>
              <p className="mt-1 text-xs">Review alerts, reminders, messages, and alarms.</p>
            </a>
            <a href="/admin/users" className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-purple-900 hover:bg-purple-100">
              <p className="text-sm font-medium">User governance</p>
              <p className="mt-1 text-xs">Create users, assign roles, and deactivate access.</p>
            </a>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OperationalPulse label="Unread Alerts" value={unreadNotifications} icon="bell" color="orange" />
          <OperationalPulse label="Overdue Tasks" value={overdueTasks} icon="alert" color="red" />
          <OperationalPulse label="Events Today" value={todayEvents} icon="calendar" color="blue" />
          <OperationalPulse label="Queued Messages" value={queuedMessages} icon="message" color="purple" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Users" value={metrics.totalUsers} href="/admin/users" />
          <MetricCard label="Applicants" value={metrics.applicants} href="/admin/applications" />
          <MetricCard label="HR Users" value={metrics.hrUsers} href="/admin/users" />
          <MetricCard label="Applications" value={metrics.applications} href="/admin/applications" />
          <MetricCard label="Pending HR Review" value={pendingHrReview} href="/admin/hr-review-queue" />
          <MetricCard label="HR Review Started" value={hrReviewStarted} href="/admin/hr-review-queue" />
          <MetricCard label="Verification Pending" value={verificationPending} href="/admin/verification-queue" />
          <MetricCard label="Verification In Progress" value={verificationInProgress} href="/admin/verification-queue" />
          <MetricCard label="Ready for DON Review" value={readyForDonReview} href="/admin/don-approval-queue" />
          <MetricCard label="DON Approval Queue" value={donApprovalQueue} href="/admin/don-approval-queue" />
          <MetricCard label="Missing Documents Requested" value={missingDocumentsRequested} href="/admin/notifications" />
          <MetricCard label="Overdue Applications" value={overdueApplications} href="/admin/hr-review-queue" />
          <MetricCard label="Verification Completion Rate" value={verificationCompletionRate} href="/admin/verification-queue" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>HR Review Work Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant Name</TableHead>
                  <TableHead>Application ID</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Missing Docs</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewQueueRows.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell className="font-medium">{application.applicantProfile.user.name ?? application.applicantProfile.user.email}</TableCell>
                    <TableCell className="font-mono text-xs">{application.id}</TableCell>
                    <TableCell>{(application.applicationSubmittedAt ?? application.submittedAt ?? application.updatedAt).toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={application.status} /></TableCell>
                    <TableCell>{application.validationIssues.length}</TableCell>
                    <TableCell>
                      <Button asChild size="sm">
                        <a href={application.status === "hr_review_pending" ? `/admin/applications/${application.id}/open-review` : `/admin/applications/${application.id}/review`}>Open Review</a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!reviewQueueRows.length ? <p className="mt-3 text-sm text-muted-foreground">No applications are waiting for HR review.</p> : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900 shadow-sm">
            <p className="text-sm font-semibold">Critical Operations</p>
            <p className="mt-3 text-3xl font-semibold">{criticalAlerts}</p>
            <p className="mt-1 text-sm">High-priority unresolved system alerts.</p>
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 text-teal-900 shadow-sm">
            <p className="text-sm font-semibold">DON Queue</p>
            <p className="mt-3 text-3xl font-semibold">{donApprovalQueue}</p>
            <p className="mt-1 text-sm">Applicants ready for final approval review.</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 text-purple-900 shadow-sm">
            <p className="text-sm font-semibold">Screening + Training</p>
            <p className="mt-3 text-3xl font-semibold">{verificationCompletionRate}</p>
            <p className="mt-1 text-sm">Verification readiness across final checklists.</p>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
