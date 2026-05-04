import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ValidationChecklist } from "@/components/ValidationChecklist";
import { PersonalInfoSection } from "@/components/applicant/PersonalInfoSection";
import { EmploymentHistorySection } from "@/components/applicant/EmploymentHistorySection";
import { PediatricExperienceSection } from "@/components/applicant/PediatricExperienceSection";
import { LicensesSection } from "@/components/applicant/LicensesSection";
import { CertificationsSection } from "@/components/applicant/CertificationsSection";
import { ReferencesSection } from "@/components/applicant/ReferencesSection";
import { ResubmitApplicationButton } from "@/components/ResubmitApplicationButton";
import { SubmitApplicationButton } from "@/components/SubmitApplicationButton";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";

const APPLICANT_NAV = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/messages", label: "Messages" },
  { href: "/applicant/onboarding", label: "Onboarding" }
];

function dateInput(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function ApplicantApplicationFormPage() {
  const user = await requireRole(["applicant"]);
  const { application } = await getOrCreateApplicantApplication(user.id);

  const [profile, employmentHistory, licenses, certifications, references, documents, validation] = await Promise.all([
    prisma.applicantProfile.findUnique({ where: { id: application.applicantProfileId }, include: { user: true } }),
    prisma.employmentHistory.findMany({ where: { applicationId: application.id }, orderBy: { startDate: "desc" } }),
    prisma.license.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } }),
    prisma.certification.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } }),
    prisma.reference.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } }),
    prisma.uploadedDocument.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } }),
    validateApplication(application.id, user.id)
  ]);

  if (!profile) throw new Error("Applicant profile not found");

  const isCorrection = application.status === "correction_requested" || application.status === "applicant_correction_required";

  return (
    <DashboardShell user={user} nav={APPLICANT_NAV}>
      <div className="grid gap-5">
        <div>
          <Link href="/applicant/application" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to upload page
          </Link>
        </div>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Digital application form</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Fill in your information</h1>
            <p className="mt-1 text-sm text-slate-600">Type your details directly. Edits save when you click "Save" in each section.</p>
          </CardContent>
        </Card>

        <ValidationChecklist {...validation} documents={documents.map((d) => ({ id: d.id, fileName: d.fileName, documentType: d.documentType }))} />

        <PersonalInfoSection
          index={1}
          defaultName={profile.user.name ?? ""}
          defaultEmail={profile.user.email}
          defaultPhone={profile.phone ?? ""}
          defaultAddress={profile.address ?? ""}
          defaultCity={profile.city ?? ""}
          defaultState={profile.state ?? ""}
          defaultZip={profile.zip ?? ""}
          defaultDateOfBirth={dateInput(profile.dateOfBirth)}
        />
        <EmploymentHistorySection index={2} jobs={employmentHistory} />
        <PediatricExperienceSection index={3} stored={profile.pediatricExperience ?? ""} />
        <LicensesSection index={4} licenses={licenses} />
        <CertificationsSection index={5} certifications={certifications} />
        <ReferencesSection index={6} references={references} />

        <Card className="border-orange-200 bg-orange-50/30">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">Ready to submit?</p>
              <p className="text-sm text-slate-600">HR will review and contact you with any questions.</p>
            </div>
            {isCorrection ? (
              <ResubmitApplicationButton canShow={validation.canSubmit} />
            ) : (
              <SubmitApplicationButton canSubmit={validation.canSubmit} />
            )}
          </CardContent>
        </Card>

        <div>
          <Button asChild variant="outline" size="sm"><Link href="/applicant/application">Back to upload page</Link></Button>
        </div>
      </div>
    </DashboardShell>
  );
}
