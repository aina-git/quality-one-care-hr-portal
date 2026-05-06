import Link from "next/link";
import { Check, Clock, FileText, XCircle } from "lucide-react";
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

  return (
    <DashboardShell user={user} nav={APPLICANT_NAV}>
      <div className="grid gap-5">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Onboarding Wizard</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Application & New Hire Forms</h1>
            <p className="mt-1 text-sm text-slate-600">
              Complete each step in order. You can fill the form online or upload a completed PDF — either works.
              Your progress saves automatically.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-orange-500 transition-all" style={{ width: `${percent}%` }} />
              </div>
              <span className="text-sm font-medium tabular-nums text-slate-700">{completed}/{total} ({percent}%)</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2">
          {progress.map((step, idx) => {
            const Icon = step.status === "completed" ? Check
              : step.status === "refused" ? XCircle
              : step.status === "in_progress" ? Clock
              : FileText;
            const tone = step.status === "completed" ? "border-emerald-300 bg-emerald-50"
              : step.status === "refused" ? "border-amber-300 bg-amber-50"
              : step.status === "in_progress" ? "border-blue-300 bg-blue-50"
              : "border-slate-200 bg-white";
            const iconTone = step.status === "completed" ? "text-emerald-700"
              : step.status === "refused" ? "text-amber-700"
              : step.status === "in_progress" ? "text-blue-700"
              : "text-slate-500";

            return (
              <Link key={step.def.key} href={`/applicant/intake/${step.def.key}`} className="group">
                <Card className={`${tone} transition hover:shadow-sm`}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={`mt-0.5 ${iconTone}`}><Icon size={20} /></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">
                          <span className="text-slate-500">Step {idx + 1}.</span> {step.def.title}
                        </p>
                        <span className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                          {step.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{step.def.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
