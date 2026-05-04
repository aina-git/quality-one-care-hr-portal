import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { DocumentPreviewLink } from "@/components/DocumentPreviewLink";
import { FieldReviewActions } from "@/components/FieldReviewActions";
import { ManualFieldForm } from "@/components/ManualFieldForm";
import { ResubmitApplicationButton } from "@/components/ResubmitApplicationButton";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitApplicationButton } from "@/components/SubmitApplicationButton";
import { ValidationChecklist } from "@/components/ValidationChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLatestApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";

const APPLICANT_NAV = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/quick-upload", label: "Upload Documents" },
  { href: "/applicant/intake-review", label: "Review Extracted Fields" },
  { href: "/applicant/messages", label: "Messages" }
];

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.9 ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
    value >= 0.7 ? "border-amber-200 bg-amber-50 text-amber-800" :
    "border-red-200 bg-red-50 text-red-800";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{pct}%</span>;
}

export default async function IntakeReviewPage() {
  const user = await requireRole(["applicant"]);
  const { application } = await getLatestApplicantApplication(user.id);
  if (!application) redirect("/applicant/application");

  const [documents, fields, validation] = await Promise.all([
    prisma.uploadedDocument.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } }),
    prisma.extractedField.findMany({ where: { applicationId: application.id }, orderBy: [{ confidence: "asc" }, { createdAt: "asc" }] }),
    validateApplication(application.id, user.id)
  ]);

  const pendingFields = fields.filter((f) => f.status === "pending_review");
  const reviewedFields = fields.filter((f) => f.status !== "pending_review");
  const lowConfidence = pendingFields.filter((f) => f.confidence < 0.9);

  return (
    <DashboardShell user={user} nav={APPLICANT_NAV}>
      <div className="grid gap-5">
        <div>
          <Link href="/applicant/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>

        {/* HEADER */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Intake Review</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Confirm what we read from your documents</h1>
            <p className="mt-1 text-sm text-slate-600">For each item below, accept it if correct, or correct/reject it if wrong. We never auto-fill low-confidence values without your confirmation.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={application.status} />
              {pendingFields.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{pendingFields.length} field{pendingFields.length === 1 ? "" : "s"} need review</span>}
              {pendingFields.length === 0 && fields.length > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">All fields reviewed</span>}
            </div>
          </CardContent>
        </Card>

        {/* No documents uploaded */}
        {documents.length === 0 && (
          <Card className="border-dashed border-slate-300">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-slate-600">No documents uploaded yet.</p>
              <p className="mt-1 text-xs text-slate-500">Upload your resume, license, or scanned application from the <Link href="/applicant/quick-upload" className="font-medium text-orange-700 hover:underline">Upload Documents</Link> page first. We&apos;ll auto-read what we can and bring you back here to confirm.</p>
            </CardContent>
          </Card>
        )}

        {/* Pending fields — needs your action */}
        {pendingFields.length > 0 && (
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><AlertCircle size={16} className="text-amber-600" /> Fields needing your review</CardTitle>
              <span className="text-xs font-medium text-slate-500">{pendingFields.length} item{pendingFields.length === 1 ? "" : "s"}</span>
            </CardHeader>
            <CardContent className="pt-0 grid gap-3">
              {pendingFields.map((field) => (
                <div key={field.id} className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{field.fieldLabel}</p>
                        <span className="text-xs text-slate-500">{field.mappedSection}</span>
                        <ConfidenceBadge value={field.confidence} />
                      </div>
                      <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 p-2 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What we read</p>
                        <p className="mt-1 text-slate-900">{field.extractedValue || <span className="italic text-slate-400">No readable value</span>}</p>
                        {field.sourceSnippet && (
                          <p className="mt-1 text-xs text-slate-500">From: &ldquo;{field.sourceSnippet}&rdquo;</p>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <FileText size={12} /> {field.sourceDocumentName ?? "Source document"}
                        <DocumentPreviewLink documentId={field.sourceDocumentId} label="Preview" />
                      </div>
                      {field.reviewReason && <p className="mt-1 text-xs text-amber-700">{field.reviewReason}</p>}
                    </div>
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <FieldReviewActions fieldId={field.id} currentValue={field.extractedValue} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Manual entry */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Add information manually</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <p className="mb-3 text-sm text-slate-600">If something isn&apos;t in your uploads but you know it, add it here.</p>
            <ManualFieldForm />
          </CardContent>
        </Card>

        {/* Already reviewed (collapsed by default) */}
        {reviewedFields.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> Already reviewed</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <details>
                <summary className="cursor-pointer text-sm text-slate-600 hover:text-orange-700">Show {reviewedFields.length} reviewed item{reviewedFields.length === 1 ? "" : "s"}</summary>
                <div className="mt-3 grid gap-2 text-sm">
                  {reviewedFields.map((field) => (
                    <div key={field.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{field.fieldLabel}</p>
                        <span className="text-xs text-slate-500">{field.mappedSection}</span>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 capitalize">{field.status.replace(/_/g, " ")}</span>
                      </div>
                      <p className="mt-1 text-slate-700">{field.applicantCorrectedValue || field.extractedValue}</p>
                    </div>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">Your uploaded documents</CardTitle>
              <span className="text-xs font-medium text-slate-500">{documents.length}</span>
            </CardHeader>
            <CardContent className="pt-0 grid gap-2 text-sm">
              {documents.map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 p-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{doc.fileName}</p>
                    <p className="text-xs text-slate-500">
                      Detected: {doc.detectedDocumentType ?? "pending"}
                      {doc.extractionConfidence !== null && doc.extractionConfidence !== undefined && (
                        <> · Read confidence: {Math.round((doc.extractionConfidence ?? 0) * 100)}%</>
                      )}
                      {" · "}{doc.processingStatus}
                    </p>
                  </div>
                  <DocumentPreviewLink documentId={doc.id} label="Preview" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Validation + submit */}
        <ValidationChecklist {...validation} documents={documents.map((d) => ({ id: d.id, fileName: d.fileName, documentType: d.documentType }))} />
        {application.status === "correction_requested" ? (
          <ResubmitApplicationButton canShow={validation.canSubmit} />
        ) : (
          <SubmitApplicationButton canSubmit={validation.canSubmit} />
        )}
      </div>
    </DashboardShell>
  );
}
