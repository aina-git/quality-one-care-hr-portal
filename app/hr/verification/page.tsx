import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { DashboardShell } from "@/components/DashboardShell";
import { DocumentPreviewLink } from "@/components/DocumentPreviewLink";
import { MarkManuallyReviewedButton } from "@/components/MarkManuallyReviewedButton";
import { MessageComposer } from "@/components/MessageComposer";
import { OperationalPulse } from "@/components/OperationalPulse";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitToDonButton } from "@/components/SubmitToDonButton";
import { UnsortedDocumentActions } from "@/components/UnsortedDocumentActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { summarizeChecklist } from "@/services/verification/verificationService";

function label(value: string | null | undefined) {
  if (!value) return "-";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function metadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function expiringCount(items: Array<{ status: string; expirationDate: Date | null }>) {
  const soon = Date.now() + 30 * 24 * 60 * 60 * 1000;
  return items.filter((item) => item.status === "expired" || (item.expirationDate && item.expirationDate.getTime() <= soon)).length;
}

export default async function VerificationQueuePage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    credential?: string;
    expiration?: string;
    result?: string;
  }>;
}) {
  const user = await requireRole(["hr", "admin", "super_admin_hr", "don_approver", "executive_view_only"]);
  const filters = await searchParams;
  const where: Prisma.FinalVerificationChecklistWhereInput = {};
  if (filters.status && filters.status !== "all") where.status = filters.status as never;
  if (filters.q) {
    where.application = {
      applicantProfile: {
        user: {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { email: { contains: filters.q, mode: "insensitive" } }
          ]
        }
      }
    };
  }

  const checklists = await prisma.finalVerificationChecklist.findMany({
    where,
    include: {
      application: {
        include: {
          applicantProfile: { include: { user: true } },
          documents: true
        }
      },
      items: { include: { verifiedByUser: true } },
      reviewedByUser: true
    },
    orderBy: { updatedAt: "desc" },
    take: 150
  });

  const filtered = checklists.filter((checklist) => {
    if (filters.role && filters.role !== "all" && !(checklist.application.desiredRole ?? "").toLowerCase().includes(filters.role.toLowerCase())) return false;
    if (filters.credential && filters.credential !== "all" && !checklist.items.some((item) => item.category === filters.credential)) return false;
    if (filters.expiration === "expired" && !checklist.items.some((item) => item.status === "expired" || (item.expirationDate && item.expirationDate < new Date()))) return false;
    if (filters.expiration === "expiring_30" && expiringCount(checklist.items) === 0) return false;
    if (filters.result && filters.result !== "all" && !checklist.items.some((item) => item.status === filters.result || (item.result ?? "").toLowerCase().includes(filters.result!.toLowerCase()))) return false;
    return true;
  });

  const totalAwaiting = filtered.filter((item) => ["in_progress", "returned_for_correction"].includes(item.status)).length;
  const ready = filtered.filter((item) => item.status === "ready_for_don_review").length;
  const blocked = filtered.filter((checklist) => summarizeChecklist(checklist).criticalBlockers.length > 0 || summarizeChecklist(checklist).missingItems.length > 0).length;
  const expired = filtered.reduce((count, checklist) => count + expiringCount(checklist.items), 0);
  const recentSubmitted = await prisma.application.count({
    where: { status: { not: "draft" }, submittedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
  });
  const unsortedDocuments = await prisma.uploadedDocument.findMany({
    where: {
      application: { status: { not: "draft" } },
      OR: [
        { detectedDocumentType: "other" },
        { extractionConfidence: { lt: 0.65 } }
      ]
    },
    include: { application: { include: { applicantProfile: { include: { user: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  const activeUnsortedDocuments = unsortedDocuments.filter((doc) => {
    const meta = metadata(doc.metadataJson);
    return meta.organizationStatus !== "assigned_by_hr" && meta.organizationStatus !== "irrelevant";
  });

  return (
    <DashboardShell user={user} nav={[
      { href: "/hr/dashboard", label: "Dashboard" },
      { href: "/hr/applications", label: "Applications" },
      { href: "/hr/verification", label: "Final Verification" },
      { href: "/don/approval-queue", label: "Ready for DON Review" }
    ]}>
      <div className="grid gap-6">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-orange-600">Verification Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold">Final employment verification operations</h1>
        </section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <OperationalPulse label="Awaiting Verification" value={totalAwaiting} icon="clock" color="orange" />
          <OperationalPulse label="Ready for DON" value={ready} icon="check" color="green" />
          <OperationalPulse label="Blocked" value={blocked} icon="alert" color="red" />
          <OperationalPulse label="Expired / Expiring" value={expired} icon="bell" color="red" />
          <OperationalPulse label="Recently Submitted" value={recentSubmitted} icon="care" color="blue" />
        </div>

        <Card>
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent>
            <form action="/hr/verification" className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <input name="q" defaultValue={filters.q ?? ""} placeholder="Applicant name/email" className="h-10 rounded-md border bg-white px-3 text-sm" />
              <input name="role" defaultValue={filters.role ?? ""} placeholder="Role" className="h-10 rounded-md border bg-white px-3 text-sm" />
              <select name="status" defaultValue={filters.status ?? "all"} className="h-10 rounded-md border bg-white px-3 text-sm">
                {["all", "in_progress", "ready_for_don_review", "returned_for_correction", "approved_by_don", "rejected_by_don"].map((option) => <option key={option} value={option}>{label(option)}</option>)}
              </select>
              <select name="credential" defaultValue={filters.credential ?? "all"} className="h-10 rounded-md border bg-white px-3 text-sm">
                {["all", "maryland_board_of_nursing", "nursys", "background_check_cgis", "oig_exclusion", "maryland_case_search", "cpr", "id_or_work_authorization"].map((option) => <option key={option} value={option}>{label(option)}</option>)}
              </select>
              <select name="expiration" defaultValue={filters.expiration ?? "all"} className="h-10 rounded-md border bg-white px-3 text-sm">
                <option value="all">All Expiration</option>
                <option value="expired">Expired</option>
                <option value="expiring_30">Expiring Within 30 Days</option>
              </select>
              <select name="result" defaultValue={filters.result ?? "all"} className="h-10 rounded-md border bg-white px-3 text-sm">
                {["all", "pending", "pending_external_check", "verified", "failed", "expired", "needs_followup", "not_applicable"].map((option) => <option key={option} value={option}>{label(option)}</option>)}
              </select>
              <Button type="submit">Apply Filters</Button>
              <Button asChild type="button" variant="outline"><Link href="/hr/verification">Reset</Link></Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Verification Work Queue</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Readiness</TableHead>
                  <TableHead>Missing</TableHead>
                  <TableHead>Expiring</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((checklist) => {
                  const summary = summarizeChecklist(checklist);
                  const lastActivity = checklist.items.map((item) => item.verifiedAt ?? item.updatedAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? checklist.updatedAt;
                  return (
                    <TableRow key={checklist.id}>
                      <TableCell>
                        <p className="font-medium">{checklist.application.applicantProfile.user.name ?? checklist.application.applicantProfile.user.email}</p>
                        <StatusBadge status={checklist.application.status} />
                      </TableCell>
                      <TableCell>{checklist.application.desiredRole ?? "-"}</TableCell>
                      <TableCell>{checklist.application.submittedAt?.toLocaleDateString() ?? "-"}</TableCell>
                      <TableCell>{summary.completionPercentage}%<br /><span className="text-xs text-muted-foreground">{label(checklist.status)}</span></TableCell>
                      <TableCell>{summary.missingItems.length + summary.criticalBlockers.length}</TableCell>
                      <TableCell>{expiringCount(checklist.items)}</TableCell>
                      <TableCell>{lastActivity.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="grid min-w-52 gap-2">
                          <Button asChild size="sm" variant="outline"><Link href={`/hr/applications/${checklist.applicationId}/verification`}>View Verification</Link></Button>
                          <Button asChild size="sm" variant="outline"><Link href={`/hr/applications/${checklist.applicationId}?tab=messages`}>Request Missing Document</Link></Button>
                          <MarkManuallyReviewedButton applicationId={checklist.applicationId} />
                          {summary.readyForDon ? <SubmitToDonButton applicationId={checklist.applicationId} /> : null}
                          <details className="rounded-md border bg-slate-50 p-2">
                            <summary className="cursor-pointer text-xs font-medium">Send Message</summary>
                            <div className="mt-2"><MessageComposer applicationId={checklist.applicationId} compact /></div>
                          </details>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Unsorted Documents</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {activeUnsortedDocuments.map((document) => {
              const meta = metadata(document.metadataJson);
              return (
                <div key={document.id} className="grid gap-3 rounded-xl border bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div>
                    <p className="font-semibold">{document.fileName}</p>
                    <p className="text-slate-600">
                      Applicant: {document.application?.applicantProfile.user.name ?? document.application?.applicantProfile.user.email ?? "-"}
                    </p>
                    <p className="text-slate-600">Current type: {document.documentType}. Suggested: {document.detectedDocumentType ?? "pending"}.</p>
                    <p className="text-slate-600">Confidence: {document.extractionConfidence ? `${Math.round(document.extractionConfidence * 100)}%` : "pending"}</p>
                    <p className="text-orange-700">{String(meta.unsortedReason ?? "Needs HR document sorting.")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <DocumentPreviewLink documentId={document.id} label="Preview Document" />
                      {document.applicationId ? <Button asChild size="sm" variant="outline"><Link href={`/hr/applications/${document.applicationId}/verification`}>Open Verification</Link></Button> : null}
                    </div>
                  </div>
                  <UnsortedDocumentActions documentId={document.id} compact />
                </div>
              );
            })}
            {!activeUnsortedDocuments.length ? <p className="text-muted-foreground">No unsorted documents are waiting for HR review.</p> : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
