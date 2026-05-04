import { DashboardShell } from "@/components/DashboardShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function readiness(application: {
  employeeOnboarding: { status: string } | null;
  finalVerificationChecklist: { status: string } | null;
}) {
  if (application.employeeOnboarding?.status === "completed") return "Onboarding complete";
  if (application.finalVerificationChecklist?.status === "approved_by_don") return "DON approved";
  return "Approved";
}

export default async function SchedulerDashboardPage() {
  const user = await requireRole(["scheduler_limited", "admin", "super_admin_hr"]);
  const applications = await prisma.application.findMany({
    where: { status: "approved" },
    include: {
      applicantProfile: { include: { user: true } },
      finalVerificationChecklist: true,
      employeeOnboarding: true
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 100
  });
  await logAction(user.id, "scheduler_view_accessed", "dashboard", "scheduler");

  return (
    <DashboardShell user={user} nav={[{ href: "/scheduler/dashboard", label: "Dashboard" }]}>
      <div className="grid gap-6">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Scheduler — Approved Staff Dashboard</div>
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-orange-600">Scheduler Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Approved applicant readiness</h1>
        </section>

        <Card>
          <CardHeader><CardTitle>Approved Applicants</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Readiness</TableHead>
                  <TableHead>Availability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>{application.applicantProfile.user.name ?? application.applicantProfile.user.email}</TableCell>
                    <TableCell>{application.applicantProfile.phone ?? "-"}</TableCell>
                    <TableCell>{application.applicantProfile.user.email}</TableCell>
                    <TableCell>{application.desiredRole ?? "-"}</TableCell>
                    <TableCell><StatusBadge status={application.status} /></TableCell>
                    <TableCell>{readiness(application)}</TableCell>
                    <TableCell>Not recorded</TableCell>
                  </TableRow>
                ))}
                {!applications.length ? (
                  <TableRow><TableCell colSpan={7} className="text-muted-foreground">No approved applicants are ready for scheduler review.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
