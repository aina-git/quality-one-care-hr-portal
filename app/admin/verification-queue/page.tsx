import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNav } from "@/lib/adminNav";

export default async function AdminVerificationQueuePage() {
  const user = await requireRole(["admin", "super_admin_hr", "executive_view_only"]);
  const checklists = await prisma.finalVerificationChecklist.findMany({
    include: {
      application: { include: { applicantProfile: { include: { user: true } } } },
      items: true
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100
  });
  return (
    <DashboardShell user={user} nav={adminNav}>
      <Card>
        <CardHeader><CardTitle>Admin Verification Queue</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Applicant</TableHead><TableHead>Application</TableHead><TableHead>Application Status</TableHead><TableHead>Verification Status</TableHead><TableHead>Open Items</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {checklists.map((checklist) => (
                <TableRow key={checklist.id}>
                  <TableCell className="font-medium">{checklist.application.applicantProfile.user.name ?? checklist.application.applicantProfile.user.email}</TableCell>
                  <TableCell className="font-mono text-xs">{checklist.applicationId}</TableCell>
                  <TableCell><StatusBadge status={checklist.application.status} /></TableCell>
                  <TableCell className="capitalize">{checklist.status.replace(/_/g, " ")}</TableCell>
                  <TableCell>{checklist.items.filter((item) => !["verified", "not_applicable"].includes(item.status)).length}</TableCell>
                  <TableCell><Button asChild size="sm"><Link href={`/admin/applications/${checklist.applicationId}/verification`}>Open Verification</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!checklists.length ? <p className="mt-3 text-sm text-muted-foreground">No final verification checklists are active.</p> : null}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
