import Link from "next/link";
import { ArrowRight, Check, Clock, FileText, Sparkles, XCircle } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { getIntakeProgress } from "@/services/intake/intakeWizardService";

const APPLICANT_NAV = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/intake", label: "Intake Wizard" },
  { href: "/applicant/messages", label: "Messages" },
  { href: "/applicant/onboarding", label: "Onboarding" }
];

export default async function ApplicantIntakeIndexPage() {
  const user = await requireRole(["applicant"]);
  const { application } = await getOrCreateApplicantApplication(user.id);
  const progress = await getIntakeProgress(application.id, {
    desiredRole: application.desiredRole,
    isExistingEmployee: false
  });

  const completed = progress.filter((p) => p.status === "completed" || p.status === "refused").length;
  const total = progress.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const firstIncomplete = progress.find((p) => p.status !== "completed" && p.status !== "refused");
  const isAllDone = total > 0 && completed === total;

  return (
    <DashboardShell user={user} nav={APPLICANT_NAV}>
      <div className="grid gap-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 sm:p-8 shadow-sm">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-orange-200/40 blur-3xl" aria-hidden />
          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">
              <Sparkles size={12} /> Welcome to Quality One Care
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Hi {user.name?.split(" ")[0] ?? "there"} — let&apos;s get you set up.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-700 sm:text-base">
              This is your application packet for Quality One Care Home Health. Work through the steps in order — each one is short. Your progress saves automatically, so you can pause and come back any time.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 rounded-full bg-white shadow-inner overflow-hidden ring-1 ring-orange-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all" style={{ width: `${percent}%` }} />
                </div>
                <span className="text-sm font-semibold tabular-nums text-orange-900">{completed} of {total} done</span>
              </div>
              {firstIncomplete && !isAllDone && (
                <Link
                  href={`/applicant/intake/${firstIncomplete.def.key}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
                >
                  {percent === 0 ? "Start packet" : `Continue with ${firstIncomplete.def.shortLabel}`} <ArrowRight size={16} />
                </Link>
              )}
              {isAllDone && (
                <Link
                  href="/applicant/intake/new_hire_checklist"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Final checklist <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* What you'll need */}
        {percent === 0 && (
          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-blue-950">Have these handy before you start</p>
              <ul className="mt-2 grid gap-1 text-sm text-blue-900 sm:grid-cols-2">
                <li>• Your Social Security number</li>
                <li>• Maryland nursing license # &amp; expiration</li>
                <li>• CPR / BLS card &amp; expiration</li>
                <li>• Last 3 employers&apos; supervisor contacts</li>
                <li>• Bank routing &amp; account numbers</li>
                <li>• A voided check or bank slip (PDF)</li>
              </ul>
              <p className="mt-2 text-xs italic text-blue-800">It&apos;s OK if you don&apos;t have everything — you can save and come back. Most steps unlock once previous info is filled.</p>
            </CardContent>
          </Card>
        )}

        {/* Step list */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">All steps</p>
          <div className="grid gap-2">
            {progress.map((step, idx) => {
              const isDone = step.status === "completed" || step.status === "refused";
              const Icon = step.status === "completed" ? Check
                : step.status === "refused" ? XCircle
                : step.status === "in_progress" ? Clock
                : FileText;
              const tone = step.status === "completed" ? "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50"
                : step.status === "refused" ? "border-amber-200 bg-amber-50/60 hover:bg-amber-50"
                : step.status === "in_progress" ? "border-blue-200 bg-blue-50/60 hover:bg-blue-50"
                : "border-slate-200 bg-white hover:bg-slate-50";
              const iconWrap = step.status === "completed" ? "bg-emerald-100 text-emerald-700"
                : step.status === "refused" ? "bg-amber-100 text-amber-700"
                : step.status === "in_progress" ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-500";
              const statusLabel = step.status === "completed" ? "Complete"
                : step.status === "refused" ? "Submitted"
                : step.status === "in_progress" ? "In progress"
                : step.status === "skipped" ? "Skipped"
                : "Not started";
              const statusBadge = step.status === "completed" ? "bg-emerald-100 text-emerald-800"
                : step.status === "refused" ? "bg-amber-100 text-amber-800"
                : step.status === "in_progress" ? "bg-blue-100 text-blue-800"
                : "bg-slate-100 text-slate-600";

              return (
                <Link key={step.def.key} href={`/applicant/intake/${step.def.key}`} className="group block">
                  <div className={`flex items-start gap-4 rounded-xl border p-4 transition ${tone}`}>
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            <span className="mr-1 text-slate-500">{idx + 1}.</span>
                            {step.def.title}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-slate-600">{step.def.description}</p>
                        </div>
                        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusBadge}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    <ArrowRight size={16} className={`mt-2 flex-shrink-0 transition group-hover:translate-x-0.5 ${isDone ? "text-slate-400" : "text-orange-500"}`} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-xs text-slate-600">
            <p>
              Need to upload a completed PDF instead of typing? You can do that on the <Link href="/applicant/quick-upload" className="font-semibold text-orange-700 hover:underline">Upload Documents</Link> page and HR will attach it to the right step. Questions? Use the <Link href="/applicant/messages" className="font-semibold text-orange-700 hover:underline">Messages</Link> page to reach HR directly.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
