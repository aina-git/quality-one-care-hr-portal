import Link from "next/link";
import { ArrowRight, FileEdit, FileStack } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ResubmitApplicationButton } from "@/components/ResubmitApplicationButton";
import { SubmitApplicationButton } from "@/components/SubmitApplicationButton";
import { BucketUpload } from "@/components/applicant/BucketUpload";
import { IntakeLocationCard } from "@/components/applicant/IntakeLocationCard";
import { DeleteApplicationButton } from "@/components/applicant/DeleteApplicationButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidationChecklist } from "@/components/ValidationChecklist";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { stageLabel } from "@/lib/outcomeColor";

const APPLICANT_NAV = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/messages", label: "Messages" },
  { href: "/applicant/onboarding", label: "Onboarding" }
];

const BUCKETS = [
  {
    bucket: "Application Form",
    title: "(a) Application Form",
    description: "Upload your completed Quality One Care application form. Or fill it out digitally below.",
    required: false
  },
  {
    bucket: "Licenses & Background",
    title: "(b) Licenses & Background Papers",
    description: "Nursing license, CPR/BLS card, training certificates, immunization records, TB test, NSO insurance.",
    required: true
  },
  {
    bucket: "IDs / SSN / Passport",
    title: "(c) IDs / SSN / Passport",
    description: "Driver's license, state ID, Social Security card, passport, or work authorization.",
    required: true
  },
  {
    bucket: "Resume & Cover Letter",
    title: "(d) Resume & Cover Letter",
    description: "Your most recent resume and (optional) cover letter.",
    required: true
  },
  {
    bucket: "Combined Package",
    title: "(e) Combined Package",
    description: "If you scanned all of the above into one PDF, drop it here. Otherwise, use buckets (a)–(d).",
    required: false
  }
];

export default async function ApplicantApplicationPage() {
  const user = await requireRole(["applicant"]);
  const { application } = await getOrCreateApplicantApplication(user.id);
  const [documents, validation, profile] = await Promise.all([
    prisma.uploadedDocument.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } }),
    validateApplication(application.id, user.id),
    prisma.applicantProfile.findUnique({ where: { id: application.applicantProfileId }, include: { user: true } })
  ]);

  const docsByBucket = new Map<string, typeof documents>();
  for (const doc of documents) {
    const arr = docsByBucket.get(doc.documentType) ?? [];
    arr.push(doc);
    docsByBucket.set(doc.documentType, arr);
  }

  const isCorrection = application.status === "correction_requested" || application.status === "applicant_correction_required";

  return (
    <DashboardShell user={user} nav={APPLICANT_NAV}>
      <div className="grid gap-5">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Your application</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{profile?.user.name ?? "Applicant"}</h1>
            <p className="mt-1 text-sm text-slate-600">Status: <span className="font-medium">{stageLabel(application.status)}</span> · {validation.completionPercentage}% complete</p>
          </CardContent>
        </Card>

        {isCorrection && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-amber-900">HR requested corrections</p>
                <p className="text-sm text-amber-800">Read your messages and update what&apos;s needed, then submit again.</p>
              </div>
              <Button asChild><Link href="/applicant/messages">View messages <ArrowRight size={14} /></Link></Button>
            </CardContent>
          </Card>
        )}

        <IntakeLocationCard initialLocationId={application.intakeLocationId ?? null} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileStack size={18} className="text-orange-600" /> Upload your documents</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-slate-600 mb-4">Pick the right bucket for each file. You can drag-drop multiple files into any bucket. We accept PDF, PNG, JPG, and DOCX up to 10MB each.</p>
            <div className="grid gap-3">
              {BUCKETS.map((b) => (
                <BucketUpload
                  key={b.bucket}
                  bucket={b.bucket}
                  title={b.title}
                  description={b.description}
                  required={b.required}
                  documents={(docsByBucket.get(b.bucket) ?? []).map((d) => ({ id: d.id, fileName: d.fileName, processingStatus: d.processingStatus }))}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileEdit size={18} className="text-orange-600" /> Or fill out the application form digitally</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-slate-600 mb-3">Skip the paper form — type your information directly. We&apos;ll save it as you go.</p>
            <Button asChild variant="outline"><Link href="/applicant/application/form">Open digital application form <ArrowRight size={14} /></Link></Button>
          </CardContent>
        </Card>

        <ValidationChecklist {...validation} documents={documents.map((d) => ({ id: d.id, fileName: d.fileName, documentType: d.documentType }))} />

        <Card className="border-orange-200 bg-orange-50/30">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">Ready to submit?</p>
              <p className="text-sm text-slate-600">Once submitted, HR reviews your application. You&apos;ll get a message if anything needs your attention.</p>
            </div>
            {isCorrection ? (
              <ResubmitApplicationButton canShow={validation.canSubmit} />
            ) : (
              <SubmitApplicationButton canSubmit={validation.canSubmit} />
            )}
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">Need to start over?</p>
              <p className="text-sm text-slate-600">
                Delete this application and begin a fresh one with the same email. This permanently removes your uploads,
                form entries, and any review notes attached to it.
              </p>
            </div>
            <DeleteApplicationButton applicantName={profile?.user.name ?? ""} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
