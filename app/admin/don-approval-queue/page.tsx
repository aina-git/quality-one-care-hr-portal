import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNav } from "@/lib/adminNav";

export default async function AdminDonApprovalQueuePage() {
  const user = await requireRole(["admin", "super_admin_hr", "executive_view_only"]);
  const rows = await prisma.finalVerificationChecklist.findMany({
    where: { status: "ready_for_don_review" },
    include: { application: { include: { applicantProfile: { include: { user: true } } } } },
    orderBy: { submittedToDonAt: "desc" },
    take: 100
  });
  return (
    <DashboardShell user={user} nav={adminNav}>
      <Card>
        <CardHeader><CardTitle>Admin DON Approval Queue</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Applicant</TableHead><TableHead>Application</TableHead><TableHead>Submitted to DON</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.application.applicantProfile.user.name ?? row.application.applicantProfile.user.email}</TableCell>
                  <TableCell className="font-mono text-xs">{row.applicationId}</TableCell>
                  <TableCell>{row.submittedToDonAt?.toLocaleString("en-US") ?? row.updatedAt.toLocaleString("en-US")}</TableCell>
                  <TableCell className="capitalize">{row.status.replace(/_/g, " ")}</TableCell>
                  <TableCell><Button asChild size="sm"><Link href={`/don/final-approval/${row.applicationId}`}>Open Final Approval</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length ? <p className="mt-3 text-sm text-muted-foreground">No applications are ready for DON approval.</p> : null}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
