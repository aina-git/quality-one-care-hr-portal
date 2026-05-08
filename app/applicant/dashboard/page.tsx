import Link from "next/link";
import { ArrowRight, CheckCircle2, CheckSquare, Circle, FileText, MessageSquare, Upload } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { StatusBadge } from "@/components/StatusBadge";
import { ResubmitApplicationButton } from "@/components/ResubmitApplicationButton";
import { SubmitApplicationButton } from "@/components/SubmitApplicationButton";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLatestApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { outcomeColorFor, colorClasses, colorLabel, stageLabel } from "@/lib/outcomeColor";
import { ApplicantProgressTimeline } from "@/components/ApplicantProgressTimeline";
import { getApplicationProgress } from "@/services/applicantProgressService";
import { getIntakeProgress } from "@/services/intake/intakeWizardService";
import { NotificationPreferencesCard } from "@/components/applicant/NotificationPreferencesCard";
import { ConfirmContactInfoBanner } from "@/components/applicant/ConfirmContactInfoBanner";

const APPLICANT_NAV = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/intake", label: "Intake Wizard" },
  { href: "/applicant/quick-upload", label: "Upload Documents" },
  { href: "/applicant/intake-review", label: "Review Extracted Fields" },
  { href: "/applicant/messages", label: "Messages" },
  { href: "/applicant/onboarding", label: "Onboarding" }
];

type Stage = { key: string; label: string; reachedStatuses: string[] };

const STAGES: Stage[] = [
  { key: "draft", label: "Draft started", reachedStatuses: ["draft", "application_uploaded"] },
  { key: "submitted", label: "Application submitted", reachedStatuses: ["submitted", "resubmitted", "intake_review_started"] },
  { key: "hr_review", label: "HR review", reachedStatuses: ["hr_review_pending", "hr_review_started", "ai_analysis_in_progress"] },
  { key: "verification", label: "Verification", reachedStatuses: ["ready_for_verification", "verification_pending", "verification_in_progress", "verification_passed", "verification_issues_found"] },
  { key: "don", label: "DON approval", reachedStatuses: ["ready_for_don_review", "don_review", "don_review_started"] },
  { key: "outcome", label: "Outcome", reachedStatuses: ["don_approved", "approved", "don_rejected", "rejected", "final_outcome_sent", "final_not_approved", "completed", "ready_for_interview"] }
];

function stageReached(currentStatus: string, stage: Stage, allStages: Stage[]): "done" | "current" | "upcoming" {
  const stageIdx = allStages.findIndex((s) => s.key === stage.key);
  const currentIdx = allStages.findIndex((s) => s.reachedStatuses.includes(currentStatus));
  if (currentIdx === -1) return "upcoming";
  if (stageIdx < currentIdx) return "done";
  if (stageIdx === currentIdx) return "current";
  return "upcoming";
}

function nextActionFor(status: string, canSubmit: boolean) {
  if (status === "draft") {
    return canSubmit
      ? { text: "Your application is complete. Submit it now.", cta: "Submit application", href: "/applicant/application" }
      : { text: "Finish your application sections.", cta: "Continue application", href: "/applicant/application" };
  }
  if (status === "correction_requested" || status === "applicant_correction_required" || status === "applicant_response_required") {
    return { text: "HR requested changes. Review the message and resubmit.", cta: "View messages", href: "/applicant/messages" };
  }
  if (["submitted", "resubmitted", "hr_review_pending", "hr_review_started", "ai_analysis_in_progress"].includes(status)) {
    return { text: "Your application is being reviewed by HR. No action required.", cta: "View progress", href: "/applicant/application" };
  }
  if (status.startsWith("verification")) {
    return { text: "Your credentials are being verified. No action required.", cta: "View progress", href: "/applicant/application" };
  }
  if (status === "ready_for_don_review" || status.startsWith("don_review")) {
    return { text: "Your file is with the DON for final approval.", cta: "View progress", href: "/applicant/application" };
  }
  if (status === "don_approved" || status === "approved") {
    return { text: "Approved! Onboarding tasks are ready for you.", cta: "Open onboarding", href: "/applicant/onboarding" };
  }
  if (status === "don_rejected" || status === "rejected" || status === "final_not_approved") {
    return { text: "Your application was not approved. Check messages for details.", cta: "View messages", href: "/applicant/messages" };
  }
  return { text: "Your application is in progress.", cta: "View application", href: "/applicant/application" };
}

export default async function ApplicantDashboardPage() {
  const user = await requireRole(["applicant"]);
  const { application } = await getLatestApplicantApplication(user.id);

  if (!application) {
    return (
      <DashboardShell user={user} nav={APPLICANT_NAV.slice(0, 3)}>
        <div className="grid gap-5">
          <div className="relative overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-8 shadow-sm">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-orange-200/40 blur-3xl" aria-hidden />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Welcome to Quality One Care</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Hi {user.name?.split(" ")[0] ?? "there"} — let&apos;s get you set up.</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-700">
                Walk through your new-hire packet step by step. Each step is short and saves automatically. You can pause and come back any time.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild size="lg"><Link href="/applicant/intake">Start intake packet <ArrowRight size={16} /></Link></Button>
                <Button asChild variant="outline"><Link href="/applicant/quick-upload"><Upload size={16} /> Upload existing documents</Link></Button>
              </div>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const [validation, documents, messages, profilePhoto, onboardingChecklist, openLicenseAlerts, progress, intakeProgress, applicantProfile] = await Promise.all([
    validateApplication(application.id, user.id),
    prisma.uploadedDocument.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } }),
    prisma.applicantMessage.findMany({ where: { applicationId: application.id, visibleToApplicant: true }, orderBy: { createdAt: "desc" }, take: 3 }),
    prisma.uploadedDocument.findFirst({ where: { applicantProfileId: application.applicantProfileId, documentType: "profile_photo" }, orderBy: { createdAt: "desc" } }),
    prisma.onboardingChecklist.findUnique({ where: { applicationId: application.id }, include: { items: { orderBy: { createdAt: "asc" } } } }),
    prisma.licenseAlert.findMany({ where: { applicationId: application.id, resolved: false }, orderBy: { createdAt: "desc" }, take: 3 }),
    getApplicationProgress(application.id),
    getIntakeProgress(application.id, { desiredRole: application.desiredRole, isExistingEmployee: false }).catch(() => []),
    prisma.applicantProfile.findUnique({ where: { id: application.applicantProfileId } })
  ]);
  const intakeCompleted = intakeProgress.filter((p) => p.status === "completed" || p.status === "refused").length;
  const intakeTotal = intakeProgress.length;
  const intakePercent = intakeTotal > 0 ? Math.round((intakeCompleted / intakeTotal) * 100) : 0;
  const firstIncompleteIntakeStep = intakeProgress.find((p) => p.status !== "completed" && p.status !== "refused");

  const action = nextActionFor(application.status, validation.canSubmit);
  const isCorrection = application.status === "correction_requested" || application.status === "applicant_correction_required";
  const onboardingItems = onboardingChecklist?.items ?? [];
  const completedOnboardingItems = onboardingItems.filter((item) => item.status !== "pending").length;
  const showOnboarding = onboardingChecklist && onboardingItems.length > 0;

  return (
    <DashboardShell user={user} nav={APPLICANT_NAV}>
      <div className="grid gap-5">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Applicant Application Dashboard</div>

        <ConfirmContactInfoBanner
          emailIsTemporary={Boolean(applicantProfile?.emailIsTemporary)}
          phoneIsTemporary={Boolean(applicantProfile?.phoneIsTemporary)}
          currentEmail={user.email}
          currentPhone={applicantProfile?.phone ?? ""}
          currentCarrier={applicantProfile?.phoneCarrier ?? ""}
        />

        {progress?.stages?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Where you are in the process</CardTitle>
            </CardHeader>
            <CardContent>
              <ApplicantProgressTimeline stages={progress.stages} compact />
            </CardContent>
          </Card>
        ) : null}

        {/* HEADER + Next Action */}
        {(() => {
          const color = outcomeColorFor(application.status);
          const cls = colorClasses(color);
          return (
        <Card className={`border-2 ${cls.border} ${color !== "neutral" ? cls.bg : ""}`}>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start gap-5">
              <ProfilePhoto document={profilePhoto} viewerUserId={user.id} name={user.name ?? user.email} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Welcome back</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{user.name ?? "Applicant"}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cls.pill}`}>
                    <span className={`inline-block h-2 w-2 rounded-full ${cls.dot}`} />
                    {colorLabel(color).toUpperCase()}
                  </span>
                  <span className="text-sm text-slate-700 font-medium">{stageLabel(application.status)}</span>
                  <span className="text-sm text-slate-500">·</span>
                  <span className="text-sm text-slate-600">{validation.completionPercentage}% complete</span>
                </div>
              </div>
            </div>

            {/* Next action banner */}
            <div className={`mt-5 flex flex-wrap items-center gap-3 rounded-xl border p-4 ${isCorrection ? "border-amber-300 bg-amber-50" : "border-orange-200 bg-orange-50"}`}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">What&apos;s next</p>
                <p className="mt-1 font-semibold text-slate-900">{action.text}</p>
              </div>
              <Button asChild><Link href={action.href}>{action.cta} <ArrowRight size={16} /></Link></Button>
            </div>
          </CardContent>
        </Card>
          );
        })()}

        {/* PROGRESS TIMELINE — the master plan's core "progress tracker" */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Application Progress</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ol className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              {STAGES.map((stage) => {
                const state = stageReached(application.status, stage, STAGES);
                return (
                  <li key={stage.key} className={`rounded-md border p-3 text-sm ${
                    state === "done" ? "border-emerald-200 bg-emerald-50" :
                    state === "current" ? "border-orange-300 bg-orange-50" :
                    "border-slate-200 bg-slate-50"
                  }`}>
                    <div className="flex items-center gap-2">
                      {state === "done" ? <CheckCircle2 size={16} className="text-emerald-600" /> : state === "current" ? <Circle size={16} className="text-orange-600" fill="currentColor" /> : <Circle size={16} className="text-slate-400" />}
                      <span className={`font-medium ${state === "upcoming" ? "text-slate-500" : "text-slate-900"}`}>{stage.label}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        {/* INTAKE WIZARD — promote the new packet flow */}
        {intakeTotal > 0 && (
          <Card className="overflow-hidden border-orange-200">
            <CardContent className="p-0">
              <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Intake Packet</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">
                    {intakePercent === 0 ? "Start your new-hire packet" :
                     intakePercent === 100 ? "All packet steps complete" :
                     "Continue your intake packet"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {intakeCompleted} of {intakeTotal} steps complete{firstIncompleteIntakeStep ? ` · up next: ${firstIncompleteIntakeStep.def.shortLabel}` : ""}.
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all" style={{ width: `${intakePercent}%` }} />
                  </div>
                </div>
                <Button asChild size="lg">
                  <Link href={firstIncompleteIntakeStep ? `/applicant/intake/${firstIncompleteIntakeStep.def.key}` : "/applicant/intake"}>
                    {intakePercent === 0 ? "Start packet" : intakePercent === 100 ? "Review packet" : "Continue"} <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Two-column body */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">

          {/* LEFT — Pending action items + Quick links */}
          <div className="grid gap-4">
            {validation.blockingIssues.length > 0 && (
              <Card className="border-red-200 bg-red-50/40">
                <CardHeader className="pb-3"><CardTitle className="text-base text-red-900">Items needing your attention</CardTitle></CardHeader>
                <CardContent className="pt-0 grid gap-2 text-sm">
                  {validation.blockingIssues.slice(0, 5).map((issue) => (
                    <div key={issue.id} className="rounded-md border border-red-200 bg-white p-3">
                      <p className="font-semibold text-slate-900">{issue.section}{issue.fieldKey ? ` · ${issue.fieldKey}` : ""}</p>
                      <p className="mt-1 text-slate-700">{issue.message}</p>
                      {issue.requiredAction && <p className="mt-1 text-xs text-red-800">{issue.requiredAction}</p>}
                    </div>
                  ))}
                  <Button asChild className="justify-self-start mt-1"><Link href="/applicant/application">Fix on application <ArrowRight size={14} /></Link></Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Quick links</CardTitle></CardHeader>
              <CardContent className="pt-0 grid gap-2 sm:grid-cols-2">
                <Link href="/applicant/intake" className="flex items-center gap-3 rounded-md border-2 border-orange-300 bg-orange-50 p-3 hover:border-orange-400 hover:bg-orange-100 transition-colors">
                  <CheckSquare size={18} className="text-orange-600" />
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">Intake packet</p>
                    <p className="text-slate-600">Step-by-step new-hire forms</p>
                  </div>
                </Link>
                <Link href="/applicant/application" className="flex items-center gap-3 rounded-md border bg-slate-50 p-3 hover:border-orange-300 hover:bg-orange-50 transition-colors">
                  <FileText size={18} className="text-orange-600" />
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">Application form</p>
                    <p className="text-slate-600">Edit your sections</p>
                  </div>
                </Link>
                <Link href="/applicant/quick-upload" className="flex items-center gap-3 rounded-md border bg-slate-50 p-3 hover:border-orange-300 hover:bg-orange-50 transition-colors">
                  <Upload size={18} className="text-orange-600" />
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">Upload documents</p>
                    <p className="text-slate-600">Resume, license, ID, CPR…</p>
                  </div>
                </Link>
                <Link href="/applicant/intake-review" className="flex items-center gap-3 rounded-md border bg-slate-50 p-3 hover:border-orange-300 hover:bg-orange-50 transition-colors">
                  <CheckCircle2 size={18} className="text-orange-600" />
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">Review extracted fields</p>
                    <p className="text-slate-600">Confirm what we read from your docs</p>
                  </div>
                </Link>
                <Link href="/applicant/messages" className="flex items-center gap-3 rounded-md border bg-slate-50 p-3 hover:border-orange-300 hover:bg-orange-50 transition-colors">
                  <MessageSquare size={18} className="text-orange-600" />
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">Messages</p>
                    <p className="text-slate-600">{messages.length > 0 ? `${messages.length} recent` : "No messages yet"}</p>
                  </div>
                </Link>
              </CardContent>
            </Card>

            {showOnboarding && (
              <Card className="border-emerald-200 bg-emerald-50/40">
                <CardHeader className="pb-3"><CardTitle className="text-base text-emerald-900">Onboarding</CardTitle></CardHeader>
                <CardContent className="pt-0 grid gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{completedOnboardingItems} of {onboardingItems.length} items complete</span>
                    <Button asChild size="sm"><Link href="/applicant/onboarding">Continue</Link></Button>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-emerald-200/40">
                    <div className="h-full bg-emerald-500" style={{ width: `${onboardingItems.length ? Math.round((completedOnboardingItems / onboardingItems.length) * 100) : 0}%` }} />
                  </div>
                </CardContent>
              </Card>
            )}

            <NotificationPreferencesCard
              applicantEmail={user.email}
              defaultPhone={applicantProfile?.phone ?? ""}
              defaultCarrier={applicantProfile?.phoneCarrier ?? ""}
              defaultSmsOverride={applicantProfile?.smsEmailOverride ?? ""}
              defaultOptIn={applicantProfile?.notificationOptIn ?? true}
            />
          </div>

          {/* RIGHT — recent messages + alerts */}
          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">Recent messages</CardTitle>
                {messages.length > 0 && <Link href="/applicant/messages" className="text-xs font-medium text-orange-700 hover:underline">View all</Link>}
              </CardHeader>
              <CardContent className="pt-0 grid gap-2 text-sm">
                {messages.length === 0 && <p className="text-slate-400 italic">No messages yet.</p>}
                {messages.map((m) => (
                  <div key={m.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                    <p className="font-semibold text-slate-900">{m.subject}</p>
                    <p className="mt-1 text-slate-700 line-clamp-2">{m.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {openLicenseAlerts.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/40">
                <CardHeader className="pb-3"><CardTitle className="text-base text-amber-900">License alerts</CardTitle></CardHeader>
                <CardContent className="pt-0 grid gap-2 text-sm">
                  {openLicenseAlerts.map((alert) => (
                    <div key={alert.id} className="rounded-md border border-amber-200 bg-white p-2.5">
                      <p className="font-semibold capitalize text-amber-900">{alert.alertType.replace(/_/g, " ")}</p>
                      <p className="text-slate-700">{alert.message}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Submit / Resubmit at the bottom — kept reachable */}
        {(application.status === "draft" || isCorrection) && (
          <Card className="border-orange-200 bg-orange-50/30">
            <CardContent className="p-4">
              {isCorrection
                ? <ResubmitApplicationButton canShow={validation.canSubmit} />
                : <SubmitApplicationButton canSubmit={validation.canSubmit} />}
              {!validation.canSubmit && <p className="mt-2 text-xs text-slate-600">Resolve the items above to enable submission.</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
