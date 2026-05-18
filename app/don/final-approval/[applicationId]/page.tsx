import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2, FileText, Printer } from "lucide-react";
import { DonDecisionForm } from "@/components/DonDecisionForm";
import { DuplicateApplicantAlert } from "@/components/DuplicateApplicantAlert";
import { EmploymentGapAlert } from "@/components/EmploymentGapAlert";
import { PostDonDeleteApplicantButton } from "@/components/PostDonDeleteApplicantButton";
import { DashboardShell } from "@/components/DashboardShell";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logAction } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVerificationChecklist, summarizeChecklist } from "@/services/verification/verificationService";

const DON_NAV = [
  { href: "/don/approval-queue", label: "Approval Queue" }
];

function label(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-US") : "—";
}

function VerificationStatusBadge({ status }: { status: string }) {
  const tone =
    status === "verified" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
    status === "failed" || status === "expired" ? "border-red-200 bg-red-50 text-red-800" :
    status === "not_applicable" ? "border-slate-200 bg-slate-100 text-slate-600" :
    "border-amber-200 bg-amber-50 text-amber-800";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label(status)}</span>;
}

export default async function DonFinalApprovalPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await requireRole(["super_admin_hr", "don_approver", "executive_view_only"]);
  const { applicationId } = await params;
  const checklist = await getVerificationChecklist(applicationId);
  if (!checklist) redirect("/don/approval-queue");
  await logAction(user.id, "don_approval_viewed", "application", applicationId);

  const summary = summarizeChecklist(checklist);
  const application = checklist.application;
  const applicant = application.applicantProfile;
  const verifiedCount = checklist.items.filter((i) => i.status === "verified").length;
  const pendingCount = checklist.items.filter((i) => i.status === "pending" || i.status === "pending_external_check" || i.status === "needs_followup" || i.status === "not_started").length;
  const notApplicableCount = checklist.items.filter((i) => i.status === "not_applicable").length;
  const failedExpiredCount = summary.failedItems.length + summary.expiredItems.length;
  const latestLicense = application.licenses[0];
  const profilePhoto = applicant.profilePhotoDocumentId
    ? await prisma.uploadedDocument.findUnique({ where: { id: applicant.profilePhotoDocumentId }, select: { id: true, fileName: true } })
    : null;
  const canDecide = ["super_admin_hr", "don_approver"].includes(user.role);
  const isReadOnly = user.role === "executive_view_only";

  return (
    <DashboardShell user={user} nav={DON_NAV}>
      <div className="grid gap-5">
        <div>
          <Link href="/don/approval-queue" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to Approval Queue
          </Link>
        </div>

        {/* HEADER */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start gap-5">
              <ProfilePhoto document={profilePhoto} viewerUserId={user.id} name={applicant.user.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-pink-700">DON Final Approval</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{applicant.user.name ?? applicant.user.email}</h1>
                <p className="mt-1 text-sm text-slate-600">
                  {application.desiredRole ?? "Role not recorded"}
                  {latestLicense && <><span className="mx-2 text-slate-300">·</span>{latestLicense.type}{latestLicense.licenseNumber ? ` ${latestLicense.licenseNumber}` : ""}</>}
                  <span className="mx-2 text-slate-300">·</span>
                  Submitted {formatDate(application.submittedAt ?? application.applicationSubmittedAt)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={application.status} />
                  <span className="text-sm font-semibold text-slate-700">{summary.completionPercentage}% verified</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Button asChild variant="outline" size="sm"><Link href={`/don/final-approval/${application.id}/print`}><Printer size={14} /> Printable Report</Link></Button>
                <Button asChild variant="outline" size="sm"><Link href={`/hr/applications/${application.id}/verification`}>Open Verification</Link></Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* READINESS BANNER */}
        {!summary.readyForDon ? (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4 flex flex-wrap items-start gap-3">
              <AlertTriangle size={18} className="text-red-700 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">Final approval blocked</p>
                <p className="mt-1 text-sm text-red-800">
                  All required checklist items must be verified or marked not applicable before approval is allowed.
                  {summary.criticalBlockers.length > 0 && ` ${summary.criticalBlockers.length} critical blocker${summary.criticalBlockers.length === 1 ? "" : "s"} remain.`}
                  {summary.expiredItems.length > 0 && ` ${summary.expiredItems.length} item${summary.expiredItems.length === 1 ? " is" : "s are"} expired.`}
                  {summary.failedItems.length > 0 && ` ${summary.failedItems.length} item${summary.failedItems.length === 1 ? " has" : "s have"} failed.`}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : checklist.donDecision ? (
          <Card className={
            checklist.donDecision === "approved_for_hire" ? "border-emerald-200 bg-emerald-50/50" :
            checklist.donDecision === "not_approved" ? "border-red-200 bg-red-50/50" :
            "border-amber-200 bg-amber-50/50"
          }>
            <CardContent className="p-4 grid gap-3">
              <div>
                <p className="font-semibold text-slate-900">DON decision recorded: {label(checklist.donDecision)}</p>
                {checklist.donComment && <p className="mt-1 text-sm text-slate-700">{checklist.donComment}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {checklist.approvedByUser?.name ?? checklist.approvedByUser?.email ?? "DON/Admin"} · {formatDate(checklist.approvedAt ?? checklist.rejectedAt ?? checklist.updatedAt)}
                </p>
              </div>
              {(user.role === "admin" || user.role === "super_admin_hr") && (
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Post-decision cleanup</p>
                  <p className="text-xs text-slate-600 mb-2">
                    Once you no longer need this applicant&apos;s record, you can permanently delete their account and all related data.
                  </p>
                  <PostDonDeleteApplicantButton
                    userId={applicant.user.id}
                    applicantName={applicant.user.name ?? applicant.user.email}
                    decisionLabel={label(checklist.donDecision)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-700" />
              <p className="text-sm font-semibold text-emerald-900">Ready for DON decision. Record your approval below.</p>
            </CardContent>
          </Card>
        )}

        {/* Automated alerts */}
        <DuplicateApplicantAlert applicationId={application.id} />
        <EmploymentGapAlert applicationId={application.id} />

        {/* TWO COLUMN: applicant facts | checklist summary */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Applicant</CardTitle></CardHeader>
            <CardContent className="pt-0 grid gap-1 text-sm">
              <div className="grid grid-cols-[140px_1fr] py-1 border-b border-slate-100"><span className="font-medium text-slate-600">Name</span><span>{applicant.user.name ?? "—"}</span></div>
              <div className="grid grid-cols-[140px_1fr] py-1 border-b border-slate-100"><span className="font-medium text-slate-600">Email</span><span>{applicant.user.email}</span></div>
              <div className="grid grid-cols-[140px_1fr] py-1 border-b border-slate-100"><span className="font-medium text-slate-600">Phone</span><span>{applicant.phone ?? "—"}</span></div>
              <div className="grid grid-cols-[140px_1fr] py-1 border-b border-slate-100"><span className="font-medium text-slate-600">Position</span><span>{application.desiredRole ?? "—"}</span></div>
              <div className="grid grid-cols-[140px_1fr] py-1 border-b border-slate-100"><span className="font-medium text-slate-600">License</span><span>{latestLicense ? `${latestLicense.type}${latestLicense.licenseNumber ? ` · ${latestLicense.licenseNumber}` : ""}` : "—"}</span></div>
              <div className="grid grid-cols-[140px_1fr] py-1"><span className="font-medium text-slate-600">License expires</span><span>{formatDate(latestLicense?.expiresAt)}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Verification summary</CardTitle></CardHeader>
            <CardContent className="pt-0 grid gap-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-emerald-50 p-2 text-center">
                  <p className="text-xs text-emerald-700 font-medium">Verified</p>
                  <p className="text-lg font-bold text-emerald-900">{verifiedCount}</p>
                </div>
                <div className="rounded-md bg-amber-50 p-2 text-center">
                  <p className="text-xs text-amber-700 font-medium">Pending</p>
                  <p className="text-lg font-bold text-amber-900">{pendingCount}</p>
                </div>
                <div className="rounded-md bg-red-50 p-2 text-center">
                  <p className="text-xs text-red-700 font-medium">Failed/Expired</p>
                  <p className="text-lg font-bold text-red-900">{failedExpiredCount}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-2 text-center">
                  <p className="text-xs text-slate-700 font-medium">Not applicable</p>
                  <p className="text-lg font-bold text-slate-900">{notApplicableCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CHECKLIST */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><FileText size={16} /> Verification Checklist</CardTitle>
            <span className="text-xs font-medium text-slate-500">{checklist.items.length} items</span>
          </CardHeader>
          <CardContent className="pt-0 grid gap-2 text-sm">
            {checklist.items.map((item) => {
              const isExpired = item.expirationDate && item.expirationDate < new Date();
              return (
                <div key={item.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        <VerificationStatusBadge status={item.status} />
                        {isExpired && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">EXPIRED</span>}
                      </div>
                      {item.result && <p className="mt-1 text-slate-700">{item.result}</p>}
                      {item.notes && <p className="mt-1 text-xs text-slate-600 italic">{item.notes}</p>}
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                        {item.expirationDate && <span>Expires {formatDate(item.expirationDate)}</span>}
                        {item.verifiedByUser && <span>Verified by {item.verifiedByUser.name ?? item.verifiedByUser.email}</span>}
                        {item.verifiedAt && <span>{formatDate(item.verifiedAt)}</span>}
                        {item.document && <span className="text-slate-600">📎 {item.document.fileName}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* DON DECISION FORM */}
        {canDecide && !checklist.donDecision && (
          <Card className="border-pink-200 bg-pink-50/40">
            <CardHeader>
              <CardTitle className="text-lg">Record DON Decision</CardTitle>
            </CardHeader>
            <CardContent>
              <DonDecisionForm applicationId={application.id} canApprove={summary.readyForDon} />
              <p className="mt-3 text-xs text-slate-500">DON decisions are final. Approval moves the applicant to onboarding; rejection or correction routes back to HR.</p>
            </CardContent>
          </Card>
        )}

        {isReadOnly && (
          <p className="text-xs text-slate-500 italic text-center">Executive read-only access. DON decisions cannot be recorded from this account.</p>
        )}
      </div>
    </DashboardShell>
  );
}
