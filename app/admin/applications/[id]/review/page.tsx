import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { DocumentPreviewLink } from "@/components/DocumentPreviewLink";
import { HRDecisionPanel } from "@/components/HRDecisionPanel";
import { HrAddRecordForm } from "@/components/HrAddRecordForm";
import { HrContactEditor } from "@/components/HrContactEditor";
import { HrIssueFixLink } from "@/components/HrIssueFixLink";
import { HrOcrViewer } from "@/components/HrOcrViewer";
import { HrPediatricExperienceEditor } from "@/components/HrPediatricExperienceEditor";
import { HrReprocessButton } from "@/components/HrReprocessButton";
import { HrUploadDocument } from "@/components/HrUploadDocument";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { RecommendationBadge, RiskBadge } from "@/components/ReviewBadges";
import { RunReviewButton } from "@/components/RunReviewButton";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminNav } from "@/lib/adminNav";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function label(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default async function AdminApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["admin", "super_admin_hr", "executive_view_only"]);
  const { id } = await params;
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      applicantProfile: { include: { user: true } },
      documents: { orderBy: { createdAt: "desc" } },
      hrReviewQueue: true,
      aiReviewReports: { orderBy: { createdAt: "desc" }, take: 1, include: { findings: true } },
      validationIssues: { where: { resolved: false }, orderBy: { severity: "desc" } },
      statusHistory: { include: { changedBy: true }, orderBy: { createdAt: "desc" }, take: 5 },
      decisions: { orderBy: { createdAt: "desc" }, include: { createdBy: true }, take: 3 },
      employmentHistory: { orderBy: { startDate: "desc" } },
      licenses: { orderBy: { createdAt: "desc" } },
      certifications: { orderBy: { createdAt: "desc" } },
      references: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!application) {
    return (
      <DashboardShell user={user} nav={adminNav}>
        <Card><CardContent className="p-6">Application not found.</CardContent></Card>
      </DashboardShell>
    );
  }

  const profile = application.applicantProfile;
  const photoDoc = profile.profilePhotoDocumentId
    ? await prisma.uploadedDocument.findUnique({ where: { id: profile.profilePhotoDocumentId }, select: { id: true, fileName: true } })
    : null;
  const aiReport = application.aiReviewReports[0];
  const hasReport = Boolean(aiReport && aiReport.status === "completed");
  const blockingIssues = application.validationIssues.filter((i) => i.severity === "blocking");
  const warningIssues = application.validationIssues.filter((i) => i.severity === "warning");
  const showVerification = ["ready_for_verification", "verification_pending", "verification_in_progress", "verification_passed", "ready_for_don_review"].includes(application.status);

  return (
    <DashboardShell user={user} nav={adminNav}>
      <div className="grid gap-5">
        {/* Back link */}
        <div>
          <Link href="/admin/hr-review-queue" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to HR Review Queue
          </Link>
        </div>

        {/* HEADER STRIP — applicant identity + status + primary action */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start gap-5">
              <ProfilePhoto document={photoDoc} viewerUserId={user.id} name={profile.user.name} size="md" />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{profile.user.name ?? profile.user.email}</h1>
                <p className="mt-1 text-sm text-slate-600">
                  {application.desiredRole ?? "Role not recorded"}
                  <span className="mx-2 text-slate-300">·</span>
                  Submitted {formatDate(application.applicationSubmittedAt ?? application.submittedAt)}
                  <span className="mx-2 text-slate-300">·</span>
                  <span className="font-mono text-xs text-slate-500">{application.id.slice(-10)}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge status={application.status} />
                  {aiReport && <RiskBadge risk={aiReport.overallRiskLevel} />}
                  {aiReport && <RecommendationBadge recommendation={aiReport.recommendation} />}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {showVerification ? (
                  <Button asChild><Link href={`/admin/applications/${application.id}/verification`}><ShieldCheck size={16} /> Open Verification</Link></Button>
                ) : !hasReport ? (
                  <RunReviewButton applicationId={application.id} hasReport={Boolean(aiReport)} />
                ) : (
                  <p className="text-xs text-slate-500 max-w-[200px] text-right">Review the AI verdict and record a decision below ↓</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BODY — 2 columns: case file (left) | AI verdict + activity (right) */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">

          {/* LEFT — Applicant Case File */}
          <div className="grid gap-4">
            <Card id="card-contact" className="scroll-mt-4 transition-shadow rounded-xl">
              <CardHeader className="pb-3"><CardTitle className="text-base">Contact</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <HrContactEditor
                  applicationId={application.id}
                  email={profile.user.email}
                  initial={{
                    phone: profile.phone,
                    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString() : null,
                    address: profile.address,
                    city: profile.city,
                    state: profile.state,
                    zip: profile.zip
                  }}
                />
              </CardContent>
            </Card>

            <Card id="card-employment" className="scroll-mt-4 transition-shadow rounded-xl">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">Employment History</CardTitle>
                <span className="text-xs font-medium text-slate-500">{application.employmentHistory.length} record{application.employmentHistory.length === 1 ? "" : "s"}</span>
              </CardHeader>
              <CardContent className="pt-0 grid gap-3">
                {application.employmentHistory.length === 0 && <p className="text-sm text-slate-400 italic">No employment history recorded.</p>}
                {application.employmentHistory.map((job) => (
                  <div key={job.id} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-900">{job.employerName} — {job.roleTitle}</p>
                    <p className="text-slate-600">{formatDate(job.startDate)} → {job.endDate ? formatDate(job.endDate) : "Present"}{job.pediatricCare && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Pediatric</span>}</p>
                    {job.supervisorName && <p className="mt-1 text-slate-600">Supervisor: {job.supervisorName}{job.supervisorPhone ? ` · ${job.supervisorPhone}` : ""}</p>}
                    {job.duties && <p className="mt-1 whitespace-pre-wrap text-slate-700">{job.duties}</p>}
                  </div>
                ))}
                <HrAddRecordForm
                  applicationId={application.id}
                  recordType="employment"
                  buttonLabel="Add employment record"
                  fields={[
                    { key: "employerName", label: "Employer", required: true, maxLength: 200 },
                    { key: "roleTitle", label: "Role / title", required: true, maxLength: 200 },
                    { key: "startDate", label: "Start date", type: "date" },
                    { key: "endDate", label: "End date (leave blank if current)", type: "date" },
                    { key: "supervisorName", label: "Supervisor name", maxLength: 200 },
                    { key: "supervisorPhone", label: "Supervisor phone", maxLength: 50 },
                    { key: "pediatricCare", label: "Pediatric care role?", type: "checkbox", placeholder: "Tick if this role involved pediatric patients" },
                    { key: "duties", label: "Key duties / notes", type: "textarea", maxLength: 4000 }
                  ]}
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card id="card-licenses" className="scroll-mt-4 transition-shadow rounded-xl">
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <CardTitle className="text-base">Licenses</CardTitle>
                  <span className="text-xs font-medium text-slate-500">{application.licenses.length}</span>
                </CardHeader>
                <CardContent className="pt-0 grid gap-2 text-sm">
                  {application.licenses.length === 0 && <p className="text-slate-400 italic">None recorded.</p>}
                  {application.licenses.map((lic) => {
                    const expired = lic.expiresAt && lic.expiresAt < new Date();
                    return (
                      <div key={lic.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                        <p className="font-semibold text-slate-900">{lic.type}{lic.licenseNumber ? ` · ${lic.licenseNumber}` : ""}</p>
                        <p className="text-slate-600 text-xs">{lic.issuingState ?? "—"} · Expires {formatDate(lic.expiresAt)}{expired && <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">EXPIRED</span>}</p>
                      </div>
                    );
                  })}
                  <HrAddRecordForm
                    applicationId={application.id}
                    recordType="licenses"
                    buttonLabel="Add license"
                    fields={[
                      { key: "type", label: "License type", required: true, maxLength: 100, placeholder: "e.g. RN, LPN, CNA" },
                      { key: "licenseNumber", label: "License number", maxLength: 100 },
                      { key: "issuingState", label: "Issuing state", maxLength: 60 },
                      { key: "issueDate", label: "Issued on", type: "date" },
                      { key: "expiresAt", label: "Expires on", type: "date" }
                    ]}
                  />
                </CardContent>
              </Card>

              <Card id="card-certifications" className="scroll-mt-4 transition-shadow rounded-xl">
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <CardTitle className="text-base">Certifications</CardTitle>
                  <span className="text-xs font-medium text-slate-500">{application.certifications.length}</span>
                </CardHeader>
                <CardContent className="pt-0 grid gap-2 text-sm">
                  {application.certifications.length === 0 && <p className="text-slate-400 italic">None recorded.</p>}
                  {application.certifications.map((c) => (
                    <div key={c.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      <p className="text-slate-600 text-xs">{c.issuer ?? "—"} · Expires {formatDate(c.expiresAt)}</p>
                    </div>
                  ))}
                  <HrAddRecordForm
                    applicationId={application.id}
                    recordType="certifications"
                    buttonLabel="Add certification"
                    fields={[
                      { key: "name", label: "Certification name", required: true, maxLength: 200, placeholder: "e.g. CPR/BLS" },
                      { key: "issuer", label: "Issuer", maxLength: 200 },
                      { key: "issueDate", label: "Issued on", type: "date" },
                      { key: "expiresAt", label: "Expires on", type: "date" }
                    ]}
                  />
                </CardContent>
              </Card>
            </div>

            <Card id="card-references" className="scroll-mt-4 transition-shadow rounded-xl">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">References</CardTitle>
                <span className="text-xs font-medium text-slate-500">{application.references.length}</span>
              </CardHeader>
              <CardContent className="pt-0 grid gap-2 text-sm">
                {application.references.length === 0 && <p className="text-slate-400 italic">None recorded.</p>}
                {application.references.map((r) => (
                  <div key={r.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                    <p className="font-semibold text-slate-900">{r.name}{r.relationship ? ` · ${r.relationship}` : ""}</p>
                    <p className="text-slate-600 text-xs">{[r.employer, r.phone, r.email].filter(Boolean).join(" · ") || "No contact details"}</p>
                  </div>
                ))}
                <HrAddRecordForm
                  applicationId={application.id}
                  recordType="references"
                  buttonLabel="Add reference"
                  fields={[
                    { key: "name", label: "Reference name", required: true, maxLength: 200 },
                    { key: "relationship", label: "Relationship", maxLength: 200, placeholder: "e.g. former supervisor" },
                    { key: "employer", label: "Employer / organization", maxLength: 200 },
                    { key: "phone", label: "Phone", maxLength: 50 },
                    { key: "email", label: "Email", maxLength: 200 }
                  ]}
                />
              </CardContent>
            </Card>

            <Card id="card-pediatric" className="scroll-mt-4 transition-shadow rounded-xl">
              <CardHeader className="pb-3"><CardTitle className="text-base">Pediatric Experience</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <HrPediatricExperienceEditor applicationId={application.id} initial={profile.pediatricExperience} />
              </CardContent>
            </Card>

            <Card id="card-documents" className="scroll-mt-4 transition-shadow rounded-xl">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><FileText size={16} /> Documents</CardTitle>
                <span className="text-xs font-medium text-slate-500">{application.documents.length}</span>
              </CardHeader>
              <CardContent className="pt-0 grid gap-3 text-sm">
                {application.documents.length === 0 && <p className="text-slate-400 italic">No documents uploaded.</p>}
                {application.documents.map((doc) => (
                  <div key={doc.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5 grid gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{doc.fileName}</p>
                        <p className="text-slate-600 text-xs">{label(doc.detectedDocumentType ?? doc.documentType)} · {label(doc.processingStatus)}</p>
                      </div>
                      <DocumentPreviewLink documentId={doc.id} label="Preview" />
                    </div>
                    <HrOcrViewer applicationId={application.id} documentId={doc.id} />
                  </div>
                ))}

                <HrUploadDocument applicationId={application.id} />

                {application.documents.length > 0 && (
                  <div className="rounded-md border border-dashed border-slate-200 bg-white p-3">
                    <p className="text-xs font-medium text-slate-700 mb-1">Auto-fill from documents</p>
                    <p className="text-xs text-slate-500 mb-2">
                      Re-runs OCR on every uploaded file and copies high-confidence findings (phone, address,
                      employment, license fields, etc.) into the structured sections above.
                    </p>
                    <HrReprocessButton applicationId={application.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT — AI verdict + issues + activity */}
          <div className="grid gap-4">
            {/* AI Verdict */}
            <Card className={hasReport ? "border-blue-200 bg-blue-50/50" : "border-dashed border-slate-300"}>
              <CardHeader className="pb-3"><CardTitle className="text-base">AI Review Verdict</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {!hasReport ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-600">No review has been run yet.</p>
                    <p className="mt-1 text-xs text-slate-500">Click &ldquo;Run Review&rdquo; in the header above to generate.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 text-sm">
                    {aiReport!.summary && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</p>
                        <p className="mt-1 text-slate-800">{aiReport!.summary}</p>
                      </div>
                    )}
                    {aiReport!.findings.filter((f) => f.severity === "info").length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Strengths</p>
                        <ul className="mt-1 grid gap-1.5">
                          {aiReport!.findings.filter((f) => f.severity === "info").map((f) => (
                            <li key={f.id} className="text-slate-800"><span className="font-semibold">{f.title}.</span> {f.description}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiReport!.findings.filter((f) => f.severity !== "info").length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Concerns</p>
                        <ul className="mt-1 grid gap-1.5">
                          {aiReport!.findings.filter((f) => f.severity !== "info").map((f) => (
                            <li key={f.id} className="text-slate-800">
                              <span className={`font-semibold ${f.severity === "critical" ? "text-red-700" : f.severity === "concern" ? "text-amber-700" : "text-slate-700"}`}>{f.title}.</span> {f.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-200">Machine-learning-assisted review. Final approval must be completed by the authorized DON reviewer.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Open Issues */}
            {(blockingIssues.length > 0 || warningIssues.length > 0) ? (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /> Open Issues</CardTitle></CardHeader>
                <CardContent className="pt-0 grid gap-2">
                  {blockingIssues.map((iss) => (
                    <div key={iss.id} className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm">
                      <p className="font-semibold text-red-900">{iss.section}{iss.fieldKey ? ` · ${iss.fieldKey}` : ""}</p>
                      <p className="text-red-800">{iss.message}</p>
                      <div className="mt-1.5"><HrIssueFixLink section={iss.section} fieldKey={iss.fieldKey} /></div>
                    </div>
                  ))}
                  {warningIssues.map((iss) => (
                    <div key={iss.id} className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm">
                      <p className="font-semibold text-amber-900">{iss.section}{iss.fieldKey ? ` · ${iss.fieldKey}` : ""}</p>
                      <p className="text-amber-800">{iss.message}</p>
                      <div className="mt-1.5"><HrIssueFixLink section={iss.section} fieldKey={iss.fieldKey} /></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-4 flex items-center gap-2 text-sm text-emerald-900">
                  <CheckCircle2 size={16} className="text-emerald-700" /> No unresolved validation issues.
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
              <CardContent className="pt-0 grid gap-2 text-sm">
                {application.statusHistory.length === 0 && <p className="text-slate-400 italic">No status changes yet.</p>}
                {application.statusHistory.map((h) => (
                  <div key={h.id} className="text-xs">
                    <p className="text-slate-700"><span className="font-medium">{label(h.fromStatus)}</span> → <span className="font-semibold">{label(h.toStatus)}</span></p>
                    <p className="text-slate-500">{h.changedBy?.name ?? "System"} · {formatDate(h.createdAt)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Decision history */}
            {application.decisions.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Decision History</CardTitle></CardHeader>
                <CardContent className="pt-0 grid gap-2 text-sm">
                  {application.decisions.map((d) => (
                    <div key={d.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                      <p className="font-semibold text-slate-900">{label(d.action)}</p>
                      {d.note && <p className="text-slate-700 mt-1">{d.note}</p>}
                      <p className="text-xs text-slate-500 mt-1">{d.createdBy?.name ?? "—"} · {formatDate(d.createdAt)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* DECISION PANEL — sticky-ish at bottom of content */}
        <Card className="border-orange-200 bg-orange-50/40">
          <CardHeader>
            <CardTitle className="text-lg">Record HR Decision</CardTitle>
          </CardHeader>
          <CardContent>
            <HRDecisionPanel applicationId={application.id} />
            <p className="mt-3 text-xs text-slate-500">DON remains final approval authority. HR decisions move the case forward in the workflow.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
