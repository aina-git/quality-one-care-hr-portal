import Link from "next/link";
import type { AIReviewStatus, ApplicationStatus, Prisma, RiskLevel } from "@prisma/client";
import { DashboardShell } from "@/components/DashboardShell";
import { HrApplicationsBulkActions } from "@/components/HrApplicationsBulkActions";
import { QocCheckEmailsButton, QocRecentCredentialsButton } from "@/components/QocAutoButtons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { buildPagination } from "@/lib/security";
import { prisma } from "@/lib/prisma";

const statusOptions = ["all", "submitted", "hr_review_pending", "hr_review_started", "under_review", "correction_requested", "verification_pending", "verification_in_progress", "ready_for_don_review", "don_review", "ready_for_interview", "rejected", "approved", "final_not_approved", "archived"];
const reviewOptions = ["all", "pending", "processing", "completed", "failed", "not_run"];
const riskOptions = ["all", "low", "moderate", "high", "incomplete_review"];
const pediatricOptions = ["all", "strong", "moderate", "weak", "none", "unknown"];
const licenseOptions = ["all", "missing", "active", "expiring_30", "expired"];
const ageOptions = ["all", "over_7", "over_14", "over_30"];
const decisionOptions = ["all", "none", "proceed_to_interview", "request_clarification", "place_on_hold", "mark_not_selected", "approve_for_onboarding"];

function optionLabel(value: string) {
  if (value === "all") return "All";
  if (value === "not_run") return "Not Run";
  if (value === "none") return "None";
  if (value === "expiring_30") return "Expiring 30 Days";
  if (value === "over_7") return "Older Than 7 Days";
  if (value === "over_14") return "Older Than 14 Days";
  if (value === "over_30") return "Older Than 30 Days";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPediatricStrength(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "unknown";
  const strengthLevel = (value as Record<string, unknown>).strengthLevel;
  return typeof strengthLevel === "string" ? strengthLevel : "unknown";
}

function getLicenseStatus(expiresAtValues: Array<Date | null | undefined>) {
  if (!expiresAtValues.length) return "missing";
  const now = Date.now();
  const thirtyDays = now + 30 * 24 * 60 * 60 * 1000;
  const timestamps = expiresAtValues.map((value) => value?.getTime() ?? null).filter((value): value is number => value !== null);
  if (!timestamps.length) return "missing";
  if (timestamps.some((value) => value < now)) return "expired";
  if (timestamps.some((value) => value <= thirtyDays)) return "expiring_30";
  return "active";
}

function matchesAgeFilter(date: Date | null | undefined, filter: string) {
  if (filter === "all") return true;
  const ageDays = Math.floor((Date.now() - (date ?? new Date()).getTime()) / (24 * 60 * 60 * 1000));
  if (filter === "over_30") return ageDays > 30;
  if (filter === "over_14") return ageDays > 14;
  if (filter === "over_7") return ageDays > 7;
  return true;
}

export default async function HrApplicationsPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string;
    review?: string;
    risk?: string;
    pediatric?: string;
    license?: string;
    age?: string;
    decision?: string;
    page?: string;
  }>;
}) {
  const user = await requireRole(["hr", "admin", "super_admin_hr", "don_approver", "executive_view_only"]);
  const filters = await searchParams;
  const statusFilter = statusOptions.includes(filters.status ?? "") ? filters.status ?? "all" : "all";
  const reviewFilter = reviewOptions.includes(filters.review ?? "") ? filters.review ?? "all" : "all";
  const riskFilter = riskOptions.includes(filters.risk ?? "") ? filters.risk ?? "all" : "all";
  const pediatricFilter = pediatricOptions.includes(filters.pediatric ?? "") ? filters.pediatric ?? "all" : "all";
  const licenseFilter = licenseOptions.includes(filters.license ?? "") ? filters.license ?? "all" : "all";
  const ageFilter = ageOptions.includes(filters.age ?? "") ? filters.age ?? "all" : "all";
  const decisionFilter = decisionOptions.includes(filters.decision ?? "") ? filters.decision ?? "all" : "all";
  const { page, pageSize } = buildPagination(filters.page, 10, 10, 25);

  const where: Prisma.ApplicationWhereInput = { status: { not: "draft" } };
  if (statusFilter !== "all") where.status = statusFilter as ApplicationStatus;
  const applications = await prisma.application.findMany({
    where,
    include: {
      applicantProfile: { include: { user: true } },
      aiReviewReports: { orderBy: { createdAt: "desc" }, take: 1 },
      decisions: { orderBy: { createdAt: "desc" }, take: 1 },
      licenses: true
    },
    orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }]
  });

  const filtered = applications.filter((application) => {
    const report = application.aiReviewReports[0];
    const decision = application.decisions[0];
    const pediatricStrength = getPediatricStrength(report?.pediatricExperienceJson);
    const licenseStatus = getLicenseStatus(application.licenses.map((license) => license.expiresAt));

    if (reviewFilter === "not_run" && report) return false;
    if (reviewFilter !== "all" && reviewFilter !== "not_run" && report?.status !== reviewFilter) return false;
    if (riskFilter !== "all" && report?.overallRiskLevel !== riskFilter) return false;
    if (pediatricFilter !== "all" && pediatricStrength !== pediatricFilter) return false;
    if (licenseFilter !== "all" && licenseStatus !== licenseFilter) return false;
    if (!matchesAgeFilter(application.submittedAt ?? application.createdAt, ageFilter)) return false;
    if (decisionFilter === "none" && decision) return false;
    if (decisionFilter !== "all" && decisionFilter !== "none" && decision?.action !== decisionFilter) return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize).map((application) => {
    const report = application.aiReviewReports[0];
    const decision = application.decisions[0];
    return {
      id: application.id,
      applicantName: application.applicantProfile.user.name ?? application.applicantProfile.user.email,
      status: application.status,
      submittedLabel: application.submittedAt ? application.submittedAt.toLocaleDateString("en-US") : "Not submitted",
      reviewStatus: report?.status ?? "not run",
      riskLevel: report?.overallRiskLevel ?? null,
      recommendation: report?.recommendation ?? null,
      latestDecision: decision?.action ?? null,
      pediatricStrength: getPediatricStrength(report?.pediatricExperienceJson),
      licenseStatus: getLicenseStatus(application.licenses.map((license) => license.expiresAt)),
      reviewHref: application.status === "hr_review_pending" ? `/hr/applications/${application.id}/open-review` : `/hr/applications/${application.id}/review`,
      verificationHref: `/hr/applications/${application.id}/verification`,
      applicantProfileHref: `/hr/applicants/${application.applicantProfileId}`
    };
  });

  function pageHref(nextPage: number) {
    const query = new URLSearchParams();
    if (statusFilter !== "all") query.set("status", statusFilter);
    if (reviewFilter !== "all") query.set("review", reviewFilter);
    if (riskFilter !== "all") query.set("risk", riskFilter);
    if (pediatricFilter !== "all") query.set("pediatric", pediatricFilter);
    if (licenseFilter !== "all") query.set("license", licenseFilter);
    if (ageFilter !== "all") query.set("age", ageFilter);
    if (decisionFilter !== "all") query.set("decision", decisionFilter);
    query.set("page", String(nextPage));
    return `/hr/applications?${query.toString()}`;
  }

  return (
    <DashboardShell
      user={user}
      nav={[
        { href: "/hr/dashboard", label: "Dashboard" },
        { href: "/hr/applications", label: "Applications" },
        { href: "/hr/training", label: "Training" }
      ]}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Applications</CardTitle>
          <div className="flex items-center gap-2">
            <QocCheckEmailsButton />
            <QocRecentCredentialsButton />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-3 xl:grid-cols-7" action="/hr/applications">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Status</span>
              <select name="status" defaultValue={statusFilter} className="h-10 rounded-md border bg-white px-3">
                {statusOptions.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Review</span>
              <select name="review" defaultValue={reviewFilter} className="h-10 rounded-md border bg-white px-3">
                {reviewOptions.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Risk</span>
              <select name="risk" defaultValue={riskFilter} className="h-10 rounded-md border bg-white px-3">
                {riskOptions.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Pediatric</span>
              <select name="pediatric" defaultValue={pediatricFilter} className="h-10 rounded-md border bg-white px-3">
                {pediatricOptions.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">License</span>
              <select name="license" defaultValue={licenseFilter} className="h-10 rounded-md border bg-white px-3">
                {licenseOptions.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Application Age</span>
              <select name="age" defaultValue={ageFilter} className="h-10 rounded-md border bg-white px-3">
                {ageOptions.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Decision</span>
              <select name="decision" defaultValue={decisionFilter} className="h-10 rounded-md border bg-white px-3">
                {decisionOptions.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-2 md:col-span-3 xl:col-span-7">
              <Button type="submit">Apply</Button>
              <Button asChild type="button" variant="outline"><Link href="/hr/applications">Reset</Link></Button>
            </div>
          </form>

          <HrApplicationsBulkActions rows={rows} canAct={!["don_approver", "executive_view_only"].includes(user.role)} />

          <div className="mt-2 flex items-center justify-between text-sm">
            <p className="text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={page > 1 ? pageHref(page - 1) : pageHref(1)}>Previous</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={page < totalPages ? pageHref(page + 1) : pageHref(totalPages)}>Next</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
