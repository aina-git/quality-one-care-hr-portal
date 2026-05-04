import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, FileStack, ScanLine, CheckCircle2 } from "lucide-react";
import { QuickCredentialUploadForm } from "@/components/QuickCredentialUploadForm";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLatestApplicantApplication } from "@/services/applicationService";

const APPLICANT_NAV = [
  { href: "/applicant/dashboard", label: "Dashboard" },
  { href: "/applicant/application", label: "Application" },
  { href: "/applicant/quick-upload", label: "Upload Documents" },
  { href: "/applicant/intake-review", label: "Review Extracted Fields" },
  { href: "/applicant/messages", label: "Messages" }
];

function metadata(doc: { metadataJson: unknown }) {
  return doc.metadataJson && typeof doc.metadataJson === "object" && !Array.isArray(doc.metadataJson)
    ? doc.metadataJson as Record<string, unknown>
    : {};
}

export default async function QuickUploadPage({
  searchParams
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await requireRole(["applicant"]);
  const params = await searchParams;
  const intakeMode = params.mode === "paper" ? "paper" : params.mode === "digital" ? "digital" : "supporting_documents";
  const { application } = await getLatestApplicantApplication(user.id);
  if (!application) redirect("/applicant/application");

  const documents = await prisma.uploadedDocument.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } });
  const processed = documents.filter((doc) => doc.processingStatus === "completed").length;
  const failed = documents.filter((doc) => doc.processingStatus === "failed").length;
  const pending = documents.filter((doc) => doc.processingStatus === "pending" || doc.processingStatus === "processing").length;
  const unsorted = documents.filter((doc) => metadata(doc).organizationStatus === "unsorted").length;

  const title = intakeMode === "paper" ? "Upload your scanned application" : "Upload your documents";
  const description = intakeMode === "paper"
    ? "Drop in a completed paper application. We'll OCR-read it, classify each page, and bring extracted fields to your intake review for confirmation."
    : "Add your resume, license, ID, CPR, training certificates, references — anything that supports your application. We'll auto-classify and read what we can.";

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
            <div className="flex flex-wrap items-start gap-4">
              {intakeMode === "paper" ? <ScanLine className="h-10 w-10 text-orange-600 flex-shrink-0" /> : <FileStack className="h-10 w-10 text-teal-600 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Upload Documents</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inline counters */}
        {documents.length > 0 && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium text-slate-500">Uploaded</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{documents.length}</p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium text-slate-500">Read successfully</p>
              <p className="mt-1 text-xl font-semibold text-emerald-700">{processed}</p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium text-slate-500">Pending / processing</p>
              <p className={`mt-1 text-xl font-semibold ${pending > 0 ? "text-amber-700" : "text-slate-900"}`}>{pending}</p>
            </div>
            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium text-slate-500">Failed</p>
              <p className={`mt-1 text-xl font-semibold ${failed > 0 ? "text-red-700" : "text-slate-900"}`}>{failed}</p>
            </div>
          </div>
        )}

        {/* Upload form */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Add a document</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <QuickCredentialUploadForm intakeMode={intakeMode} />
          </CardContent>
        </Card>

        {/* Existing documents */}
        {documents.length > 0 && (
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">Your uploads</CardTitle>
              <span className="text-xs font-medium text-slate-500">{documents.length}</span>
            </CardHeader>
            <CardContent className="pt-0 grid gap-2 text-sm">
              {documents.map((doc) => {
                const meta = metadata(doc);
                const isDone = doc.processingStatus === "completed";
                const isFailed = doc.processingStatus === "failed";
                return (
                  <div key={doc.id} className={`rounded-md border p-3 ${isFailed ? "border-red-200 bg-red-50" : isDone ? "border-emerald-100 bg-emerald-50/40" : "border-slate-100 bg-slate-50"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isDone && <CheckCircle2 size={14} className="text-emerald-600" />}
                          <p className="font-semibold text-slate-900 truncate">{doc.fileName}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {doc.documentType.replace(/_/g, " ")} ·
                          {" "}{doc.processingStatus.replace(/_/g, " ")}
                          {doc.detectedDocumentType && <> · detected as {doc.detectedDocumentType.replace(/_/g, " ")}</>}
                        </p>
                        {meta.organizationStatus === "unsorted" && (
                          <p className="mt-1 text-xs text-amber-700">⚠ HR will review and sort this document.</p>
                        )}
                        {isFailed && (
                          <p className="mt-1 text-xs text-red-700">Couldn&apos;t read this file. Try uploading a clearer copy.</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap gap-3">
          {processed > 0 && (
            <Button asChild><Link href="/applicant/intake-review">Review extracted fields <ArrowRight size={14} /></Link></Button>
          )}
          <Button asChild variant="outline"><Link href="/applicant/application">Continue full application <ArrowRight size={14} /></Link></Button>
        </div>
      </div>
    </DashboardShell>
  );
}
