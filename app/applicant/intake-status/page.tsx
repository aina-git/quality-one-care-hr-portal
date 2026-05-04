import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { OperationalPulse } from "@/components/OperationalPulse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLatestApplicantApplication } from "@/services/applicationService";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { logAction } from "@/lib/audit";

export default async function IntakeStatusPage() {
  const user = await requireRole(["applicant"]);
  const { application } = await getLatestApplicantApplication(user.id);
  if (!application) redirect("/applicant/application");
  const [documents, fields, validation] = await Promise.all([
    prisma.uploadedDocument.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" } }),
    prisma.extractedField.findMany({ where: { applicationId: application.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    validateApplication(application.id, user.id)
  ]);
  await logAction(user.id, "intake_status_viewed", "application", application.id);
  const processed = documents.filter((doc) => doc.processingStatus === "completed").length;
  const pendingReview = fields.filter((field) => field.status === "pending_review").length;

  return (
    <DashboardShell user={user} nav={[
      { href: "/applicant/dashboard", label: "Dashboard" },
      { href: "/applicant/quick-upload", label: "Document Upload" },
      { href: "/applicant/intake-status", label: "Intake Status" },
      { href: "/applicant/application", label: "Application" }
    ]}>
      <div className="grid gap-6">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-orange-600">Document Intake Status</p>
          <h1 className="mt-2 text-3xl font-semibold">Review extracted information and missing items</h1>
        </section>
        {documents.length > 0 && !validation.canSubmit ? (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
            We received your documents. Please review extracted information and complete the remaining required fields.
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <OperationalPulse label="Documents Uploaded" value={documents.length} icon="check" color="blue" />
          <OperationalPulse label="Documents Processed" value={processed} icon="ai" color="purple" />
          <OperationalPulse label="Pending Review" value={pendingReview} icon="bell" color="orange" />
          <OperationalPulse label="Missing Items" value={validation.blockingIssues.length} icon="alert" color="red" />
          <OperationalPulse label="Ready to Continue" value={documents.length ? "Yes" : "No"} icon="clock" color="teal" />
          <OperationalPulse label="Ready to Submit" value={validation.canSubmit ? "Yes" : "No"} icon="check" color="green" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Uploaded Credentials</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {documents.map((doc) => <div key={doc.id} className="rounded-md border bg-slate-50 p-3"><p className="font-medium">{doc.fileName}</p><p className="text-muted-foreground">{doc.documentType} - {doc.processingStatus.replace(/_/g, " ")}</p></div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Extracted Information Found</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {fields.map((field) => <div key={field.id} className="rounded-md border bg-purple-50 p-3"><p className="font-medium">{field.fieldLabel}</p><p>{field.extractedValue}</p><p className="text-xs text-muted-foreground">{field.status.replace(/_/g, " ")} - confidence {Math.round(field.confidence * 100)}%</p></div>)}
            {!fields.length ? <p className="text-muted-foreground">No extracted fields yet. Upload documents to begin intake processing.</p> : null}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Missing Required Information</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {[...validation.blockingIssues, ...validation.warningIssues].map((issue) => (
              <div key={issue.id ?? issue.message} className={issue.severity === "blocking" ? "rounded-md border border-red-200 bg-red-50 p-3 text-red-900" : "rounded-md border border-orange-200 bg-orange-50 p-3 text-orange-900"}>
                <p className="font-semibold">{issue.section}{issue.fieldKey ? ` - ${issue.fieldKey}` : ""}</p>
                <p className="mt-1">{issue.message}</p>
                <p className="mt-1 text-xs">Reason: {issue.reason ?? issue.message}</p>
                <p className="text-xs">Required action: {issue.requiredAction ?? "Review this item."}</p>
                <p className="text-xs">Responsible party: {issue.responsibleParty ?? "Applicant"}</p>
              </div>
            ))}
            {!validation.blockingIssues.length && !validation.warningIssues.length ? <p className="text-emerald-700">No missing or unclear information is currently detected.</p> : null}
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline"><Link href="/applicant/intake-review">Review Extracted Information</Link></Button>
          <Button asChild><Link href="/applicant/application">Continue Full Application</Link></Button>
        </div>
      </div>
    </DashboardShell>
  );
}
