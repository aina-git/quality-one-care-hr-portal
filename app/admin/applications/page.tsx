import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNav } from "@/lib/adminNav";

export default async function AdminApplicationsPage() {
  const user = await requireRole(["admin", "super_admin_hr", "executive_view_only"]);
  const applications = await prisma.application.findMany({
    where: { status: { not: "draft" } },
    include: {
      applicantProfile: { include: { user: true } },
      hrReviewQueue: true,
      finalVerificationChecklist: true,
      validationIssues: { where: { resolved: false } }
    },
    orderBy: [{ applicationSubmittedAt: "desc" }, { updatedAt: "desc" }],
    take: 100
  });

  return (
    <DashboardShell user={user} nav={adminNav}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Admin Applications</CardTitle>
          {user.role !== "executive_view_only" ? (
            <Button asChild>
              <Link href="/admin/applications/new">+ Intake paper application</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Application ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell className="font-medium">{application.applicantProfile.user.name ?? application.applicantProfile.user.email}</TableCell>
                  <TableCell className="font-mono text-xs">{application.id}</TableCell>
                  <TableCell><StatusBadge status={application.status} /></TableCell>
                  <TableCell>{(application.applicationSubmittedAt ?? application.submittedAt ?? application.updatedAt).toLocaleString()}</TableCell>
                  <TableCell>{application.hrReviewQueue?.status ?? application.finalVerificationChecklist?.status ?? "-"}</TableCell>
                  <TableCell>{application.validationIssues.length}</TableCell>
                  <TableCell className="flex flex-wrap gap-2">
                    <Button asChild size="sm"><Link href={application.status === "hr_review_pending" ? `/admin/applications/${application.id}/open-review` : `/admin/applications/${application.id}/review`}>Open Review</Link></Button>
                    <Button asChild size="sm" variant="outline"><Link href={`/admin/applications/${application.id}/verification`}>Verification</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!applications.length ? <p className="mt-3 text-sm text-muted-foreground">No submitted applications yet.</p> : null}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
