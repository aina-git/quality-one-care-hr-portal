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
import { W4Step } from "@/components/applicant/intake/W4Step";
import { MW507Step } from "@/components/applicant/intake/MW507Step";
import { SkillsChecklistStep } from "@/components/applicant/intake/SkillsChecklistStep";
import { PreEmploymentTestStep } from "@/components/applicant/intake/PreEmploymentTestStep";
import { NewHireChecklistStep } from "@/components/applicant/intake/NewHireChecklistStep";
import { PlaceholderStep } from "@/components/applicant/intake/PlaceholderStep";
import { getIntakeProgress } from "@/services/intake/intakeWizardService";
import { prisma } from "@/lib/prisma";
import { ConfirmContactInfoBanner } from "@/components/applicant/ConfirmContactInfoBanner";
import { inferRoleFromDesired } from "@/services/intake/jobDescriptionSchema";
import { getApplicantKnownAddress } from "@/services/intake/applicantAddressResolver";

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
  const applicantProfile = await prisma.applicantProfile.findUnique({ where: { id: application.applicantProfileId } });

  // For tax-form steps, look up the applicant's best-known address so the
  // form pre-fills and they only need to enter remaining fields (SSN, etc).
  const needsAddressPrefill = stepKey === "w9" || stepKey === "w4" || stepKey === "mw507";
  const knownAddress = needsAddressPrefill ? await getApplicantKnownAddress(application.id) : null;

  // For the final New Hire Checklist, we need a snapshot of every other
  // step's status plus the count of documents uploaded so far.
  const isFinal = stepKey === "new_hire_checklist";
  const [progress, docCount] = isFinal
    ? await Promise.all([
        getIntakeProgress(application.id, { desiredRole: application.desiredRole, isExistingEmployee: false }),
        prisma.uploadedDocument.count({ where: { applicationId: application.id } })
      ])
    : [[], 0] as [Awaited<ReturnType<typeof getIntakeProgress>>, number];

  return (
    <DashboardShell user={user} nav={APPLICANT_NAV}>
      <div className="grid gap-5">
        <ConfirmContactInfoBanner
          emailIsTemporary={Boolean(applicantProfile?.emailIsTemporary)}
          phoneIsTemporary={Boolean(applicantProfile?.phoneIsTemporary)}
          currentEmail={user.email}
          currentPhone={applicantProfile?.phone ?? ""}
          currentCarrier={applicantProfile?.phoneCarrier ?? ""}
        />
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
            prefillAddress={knownAddress}
          />
        ) : stepKey === "w4" ? (
          <W4Step
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
            prefillAddress={knownAddress}
          />
        ) : stepKey === "mw507" ? (
          <MW507Step
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
            prefillAddress={knownAddress}
          />
        ) : stepKey === "skills_checklist" ? (
          <SkillsChecklistStep
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
            inferredPosition={inferRoleFromDesired(application.desiredRole) === "rn" ? "RN" : inferRoleFromDesired(application.desiredRole) === "lpn" ? "LPN" : ""}
          />
        ) : stepKey === "pre_employment_test" ? (
          <PreEmploymentTestStep
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
            applicantPosition={inferRoleFromDesired(application.desiredRole) === "rn" ? "RN" : inferRoleFromDesired(application.desiredRole) === "lpn" ? "LPN" : (application.desiredRole ?? "")}
          />
        ) : stepKey === "new_hire_checklist" ? (
          <NewHireChecklistStep
            applicationId={application.id}
            initialData={stepRow.data}
            initialStatus={stepRow.status}
            applicantName={user.name ?? ""}
            upstream={progress.map((p) => ({ def: p.def, status: p.status }))}
            uploadedDocCount={docCount}
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
