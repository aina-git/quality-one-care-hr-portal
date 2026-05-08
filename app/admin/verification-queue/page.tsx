import Link from "next/link";
import type { FinalVerificationStatus } from "@prisma/client";
import { DashboardShell } from "@/components/DashboardShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNav } from "@/lib/adminNav";

const PENDING_STATUSES: FinalVerificationStatus[] = ["draft"];
const IN_PROGRESS_STATUSES: FinalVerificationStatus[] = ["in_progress", "returned_for_correction"];
const ALL_STATUSES: FinalVerificationStatus[] = ["draft", "in_progress", "returned_for_correction", "ready_for_don_review", "approved_by_don", "rejected_by_don"];

const TABS = [
  { key: "pending", label: "Pending", statuses: PENDING_STATUSES },
  { key: "in_progress", label: "In Progress", statuses: IN_PROGRESS_STATUSES },
  { key: "all", label: "All", statuses: ALL_STATUSES }
] as const;

type TabKey = typeof TABS[number]["key"];

export default async function AdminVerificationQueuePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["admin", "super_admin_hr", "executive_view_only"]);
  const { tab } = await searchParams;
  const activeTab: TabKey = (TABS.find((t) => t.key === tab)?.key ?? "pending") as TabKey;
  const activeStatuses = TABS.find((t) => t.key === activeTab)!.statuses as unknown as FinalVerificationStatus[];

  const [checklists, pendingCount, inProgressCount, allCount] = await Promise.all([
    prisma.finalVerificationChecklist.findMany({
      where: { status: { in: activeStatuses } },
      include: {
        application: { include: { applicantProfile: { include: { user: true } } } },
        items: true
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 100
    }),
    prisma.finalVerificationChecklist.count({ where: { status: { in: PENDING_STATUSES } } }),
    prisma.finalVerificationChecklist.count({ where: { status: { in: IN_PROGRESS_STATUSES } } }),
    prisma.finalVerificationChecklist.count({ where: { status: { in: ALL_STATUSES } } })
  ]);

  const tabCounts: Record<TabKey, number> = { pending: pendingCount, in_progress: inProgressCount, all: allCount };

  return (
    <DashboardShell user={user} nav={adminNav}>
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2 text-sm">
          {TABS.map((entry) => (
            <Link
              key={entry.key}
              href={`/admin/verification-queue?tab=${entry.key}`}
              className={`rounded-full border px-3 py-1 ${activeTab === entry.key ? "bg-orange-600 text-white" : "bg-white"}`}
            >
              {entry.label} ({tabCounts[entry.key]})
            </Link>
          ))}
        </div>
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
            {!checklists.length ? <p className="mt-3 text-sm text-muted-foreground">No verification checklists in this view.</p> : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
