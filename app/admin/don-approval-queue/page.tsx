import Link from "next/link";
import type { FinalVerificationStatus } from "@prisma/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNav } from "@/lib/adminNav";

const AWAITING_STATUSES: FinalVerificationStatus[] = ["ready_for_don_review"];
const APPROVED_STATUSES: FinalVerificationStatus[] = ["approved_by_don"];
const ALL_STATUSES: FinalVerificationStatus[] = ["ready_for_don_review", "approved_by_don", "rejected_by_don", "returned_for_correction"];

const TABS = [
  { key: "awaiting", label: "Awaiting DON", statuses: AWAITING_STATUSES },
  { key: "approved", label: "Approved", statuses: APPROVED_STATUSES },
  { key: "all", label: "All", statuses: ALL_STATUSES }
] as const;

type TabKey = typeof TABS[number]["key"];

export default async function AdminDonApprovalQueuePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["super_admin_hr", "executive_view_only"]);
  const { tab } = await searchParams;
  const activeTab: TabKey = (TABS.find((t) => t.key === tab)?.key ?? "awaiting") as TabKey;
  const activeStatuses = TABS.find((t) => t.key === activeTab)!.statuses as unknown as FinalVerificationStatus[];

  const [rows, awaitingCount, approvedCount, allCount] = await Promise.all([
    prisma.finalVerificationChecklist.findMany({
      where: { status: { in: activeStatuses } },
      include: { application: { include: { applicantProfile: { include: { user: true } } } } },
      orderBy: [{ status: "asc" }, { submittedToDonAt: "desc" }],
      take: 100
    }),
    prisma.finalVerificationChecklist.count({ where: { status: { in: AWAITING_STATUSES } } }),
    prisma.finalVerificationChecklist.count({ where: { status: { in: APPROVED_STATUSES } } }),
    prisma.finalVerificationChecklist.count({ where: { status: { in: ALL_STATUSES } } })
  ]);

  const tabCounts: Record<TabKey, number> = { awaiting: awaitingCount, approved: approvedCount, all: allCount };

  return (
    <DashboardShell user={user} nav={adminNav}>
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2 text-sm">
          {TABS.map((entry) => (
            <Link
              key={entry.key}
              href={`/admin/don-approval-queue?tab=${entry.key}`}
              className={`rounded-full border px-3 py-1 ${activeTab === entry.key ? "bg-orange-600 text-white" : "bg-white"}`}
            >
              {entry.label} ({tabCounts[entry.key]})
            </Link>
          ))}
        </div>
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
            {!rows.length ? <p className="mt-3 text-sm text-muted-foreground">No applications in this view.</p> : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
