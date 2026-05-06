import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { IntakeStepKey } from "@prisma/client";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import {
  applicableSteps,
  getOrCreateIntakeStep,
  nextStepKey,
  previousStepKey
} from "@/services/intake/intakeWizardService";
import { ApplicationFormStep } from "@/components/applicant/intake/ApplicationFormStep";
import { HepBDeclinationStep } from "@/components/applicant/intake/HepBDeclinationStep";
import { FluDeclinationStep } from "@/components/applicant/intake/FluDeclinationStep";
import { JobDescriptionStep } from "@/components/applicant/intake/JobDescriptionStep";
import { WageDeductionStep } from "@/components/applicant/intake/WageDeductionStep";
import { PhysicalHealthStep } from "@/components/applicant/intake/PhysicalHealthStep";
import { CharacterReferenceStep } from "@/components/applicant/intake/CharacterReferenceStep";
import { DirectDepositStep } from "@/components/applicant/intake/DirectDepositStep";
import { W9Step } from "@/components/applicant/intake/W9Step";
import { PlaceholderStep } from "@/components/applicant/intake/PlaceholderStep";
import { inferRoleFromDesired } from "@/services/intake/jobDescriptionSchema";

const APPLICANT_NAV = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/intake", label: "Intake Wizard" },
  { href: "/applicant/messages", label: "Messages" },
  { href: "/applicant/onboarding", label: "Onboarding" }
];

const VALID_KEYS: IntakeStepKey[] = [
  "application_form",
  "hep_b_declination",
  "flu_declination",
  "job_description",
  "wage_deduction",
  "physical_health",
  "character_reference",
  "direct_deposit",
  "w9",
  "w4",
  "mw507",
  "skills_checklist",
  "pre_employment_test",
  "application_updates",
  "new_hire_checklist"
];

export default async function ApplicantIntakeStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!VALID_KEYS.includes(step as IntakeStepKey)) notFound();
  const stepKey = step as IntakeStepKey;

  const user = await requireRole(["applicant"]);
  const { application } = await getOrCreateApplicantApplication(user.id);

  const applicable = applicableSteps({
    desiredRole: application.desiredRole,
    isExistingEmployee: false
  });
  const stepDef = applicable.find((s) => s.key === stepKey);
  if (!stepDef) {
    return (
      <DashboardShell user={user} nav={APPLICANT_NAV}>
        <Card>
          <CardContent className="p-5 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">This step does not apply to your role.</p>
            <p className="mt-1">Return to the wizard index to see your steps.</p>
            <Link href="/applicant/intake" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-orange-700">
              <ArrowLeft size={14} /> Back to wizard
            </Link>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const stepRow = await getOrCreateIntakeStep(application.id, stepKey);
  const idx = applicable.findIndex((s) => s.key === stepKey);
  const prev = previousStepKey(stepKey, applicable);
  const next = nextStepKey(stepKey, applicable);

  return (
    <DashboardShell user={user} nav={APPLICANT_NAV}>
      <div className="grid gap-5">
        <div className="flex items-center justify-between">
          <Link href="/applicant/intake" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Wizard index
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {idx + 1} of {applicable.length}</p>
        </div>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">{stepDef.shortLabel}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{stepDef.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{stepDef.description}</p>
          </CardContent>
        </Card>

        {stepKey === "application_form" ? (
          <ApplicationFormStep
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantEmail={user.email ?? ""}
            applicantName={user.name ?? ""}
          />
        ) : stepKey === "hep_b_declination" ? (
          <HepBDeclinationStep
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
          />
        ) : stepKey === "flu_declination" ? (
          <FluDeclinationStep
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
          />
        ) : stepKey === "job_description" ? (
          <JobDescriptionStep
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
            inferredRole={inferRoleFromDesired(application.desiredRole)}
          />
        ) : stepKey === "wage_deduction" ? (
          <WageDeductionStep
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
          />
        ) : stepKey === "physical_health" ? (
          <PhysicalHealthStep
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
            applicantEmail={user.email ?? ""}
          />
        ) : stepKey === "character_reference" ? (
          <CharacterReferenceStep
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
          />
        ) : stepKey === "direct_deposit" ? (
          <DirectDepositStep
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
            applicantEmail={user.email ?? ""}
          />
        ) : stepKey === "w9" ? (
          <W9Step
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
          />
        ) : (
          <PlaceholderStep stepKey={stepKey} title={stepDef.title} />
        )}

        <div className="flex items-center justify-between">
          {prev ? (
            <Link href={`/applicant/intake/${prev}`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-orange-700">
              <ArrowLeft size={14} /> Previous step
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/applicant/intake/${next}`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-orange-700">
              Next step <ArrowRight size={14} />
            </Link>
          ) : <span />}
        </div>
      </div>
    </DashboardShell>
  );
}
