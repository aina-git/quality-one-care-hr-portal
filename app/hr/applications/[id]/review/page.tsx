import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { DocumentPreviewLink } from "@/components/DocumentPreviewLink";
import { AiAnalysisPanel } from "@/components/AiAnalysisPanel";
import { HRDecisionPanel } from "@/components/HRDecisionPanel";
import { HRNoteForm } from "@/components/HRNoteForm";
import { HrOutcomeButtons } from "@/components/HrOutcomeButtons";
import { InterviewOutcomeForm } from "@/components/InterviewOutcomeForm";
import { outcomeColorFor, colorClasses, colorLabel } from "@/lib/outcomeColor";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { RecommendationBadge, RiskBadge } from "@/components/ReviewBadges";
import { RunReviewButton } from "@/components/RunReviewButton";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startHrReviewWorkflow } from "@/services/workflow/hrReviewQueueService";

const HR_NAV = [
  { href: "/hr/dashboard", label: "Dashboard" },
  { href: "/hr/applications", label: "Applications" },
  { href: "/hr/verification", label: "Verification" },
  { href: "/hr/training", label: "Training" }
];

function label(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function dataRow(rowLabel: string, value: string | null | undefined) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5 text-sm border-b border-slate-100 last:border-0">
      <span className="font-medium text-slate-600">{rowLabel}</span>
      <span className="text-slate-900">{value && value.trim() ? value : <span className="text-slate-400 italic">Not provided</span>}</span>
    </div>
  );
}

export default async function HrApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "admin", "super_admin_hr", "don_approver", "executive_view_only"]);
  const { id } = await params;

  // If application is just-submitted and pending, claim it for HR (existing behavior)
  let application = await prisma.application.findUnique({
    where: { id },
    select: { id: true, status: true }
  });
  if (application && application.status === "hr_review_pending" && !["don_approver", "executive_view_only"].includes(user.role)) {
    await startHrReviewWorkflow(id, user.id);
    redirect(`/hr/applications/${id}/review`);
  }

  application = null;
  const fullApplication = await prisma.application.findUnique({
    where: { id },
    include: {
      applicantProfile: { include: { user: true } },
      documents: { orderBy: { createdAt: "desc" } },
      hrReviewQueue: true,
      aiReviewReports: { orderBy: { createdAt: "desc" }, take: 1, include: { findings: true } },
      validationIssues: { where: { resolved: false }, orderBy: { severity: "desc" } },
      statusHistory: { include: { changedBy: true }, orderBy: { createdAt: "desc" }, take: 5 },
      decisions: { orderBy: { createdAt: "desc" }, include: { createdBy: true }, take: 3 },
      hrNotes: { orderBy: { createdAt: "desc" }, include: { createdBy: true }, take: 5 },
      employmentHistory: { orderBy: { startDate: "desc" } },
      licenses: { orderBy: { createdAt: "desc" } },
      certifications: { orderBy: { createdAt: "desc" } },
      references: { orderBy: { createdAt: "desc" } },
      interviewRecords: { orderBy: { createdAt: "desc" }, take: 3 }
    }
  });

  if (!fullApplication) {
    return (
      <DashboardShell user={user} nav={HR_NAV}>
        <Card><CardContent className="p-6">Application not found.</CardContent></Card>
      </DashboardShell>
    );
  }

  const profile = fullApplication.applicantProfile;
  const photoDoc = profile.profilePhotoDocumentId
    ? await prisma.uploadedDocument.findUnique({ where: { id: profile.profilePhotoDocumentId }, select: { id: true, fileName: true } })
    : null;
  const aiReport = fullApplication.aiReviewReports[0];
  const hasReport = Boolean(aiReport && aiReport.status === "completed");
  const blockingIssues = fullApplication.validationIssues.filter((i) => i.severity === "blocking");
  const warningIssues = fullApplication.validationIssues.filter((i) => i.severity === "warning");
  const showVerification = ["ready_for_verification", "verification_pending", "verification_in_progress", "verification_passed", "ready_for_don_review"].includes(fullApplication.status);
  const isReadOnly = user.role === "executive_view_only" || user.role === "don_approver";

  return (
    <DashboardShell user={user} nav={HR_NAV}>
      <div className="grid gap-5">
        {/* Back link */}
        <div>
          <Link href="/hr/applications" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to Applications
          </Link>
        </div>

        {/* HEADER STRIP */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start gap-5">
              <ProfilePhoto document={photoDoc} viewerUserId={user.id} name={profile.user.name} size="md" />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{profile.user.name ?? profile.user.email}</h1>
                <p className="mt-1 text-sm text-slate-600">
                  {fullApplication.desiredRole ?? "Role not recorded"}
                  <span className="mx-2 text-slate-300">·</span>
                  Submitted {formatDate(fullApplication.applicationSubmittedAt ?? fullApplication.submittedAt)}
                  <span className="mx-2 text-slate-300">·</span>
                  <span className="font-mono text-xs text-slate-500">{fullApplication.id.slice(-10)}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge status={fullApplication.status} />
                  {aiReport && <RiskBadge risk={aiReport.overallRiskLevel} />}
                  {aiReport && <RecommendationBadge recommendation={aiReport.recommendation} />}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {showVerification ? (
                  <Button asChild><Link href={`/hr/applications/${fullApplication.id}/verification`}><ShieldCheck size={16} /> Open Verification</Link></Button>
                ) : !hasReport && !isReadOnly ? (
                  <RunReviewButton applicationId={fullApplication.id} hasReport={Boolean(aiReport)} />
                ) : (
                  <p className="text-xs text-slate-500 max-w-[200px] text-right">Review the verdict and record a decision below ↓</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BODY — 2 columns */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">

          {/* LEFT — Case File */}
          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Contact</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {dataRow("Email", profile.user.email)}
                {dataRow("Phone", profile.phone)}
                {dataRow("Date of birth", profile.dateOfBirth ? formatDate(profile.dateOfBirth) : null)}
                {dataRow("Address", [profile.address, profile.city, profile.state, profile.zip].filter(Boolean).join(", "))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">Employment History</CardTitle>
                <span className="text-xs font-medium text-slate-500">{fullApplication.employmentHistory.length} record{fullApplication.employmentHistory.length === 1 ? "" : "s"}</span>
              </CardHeader>
              <CardContent className="pt-0 grid gap-3">
                {fullApplication.employmentHistory.length === 0 && <p className="text-sm text-slate-400 italic">No employment history recorded.</p>}
                {fullApplication.employmentHistory.map((job) => (
                  <div key={job.id} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-900">{job.employerName} — {job.roleTitle}</p>
                    <p className="text-slate-600">{formatDate(job.startDate)} → {job.endDate ? formatDate(job.endDate) : "Present"}{job.pediatricCare && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Pediatric</span>}</p>
                    {job.supervisorName && <p className="mt-1 text-slate-600">Supervisor: {job.supervisorName}{job.supervisorPhone ? ` · ${job.supervisorPhone}` : ""}</p>}
                    {job.duties && <p className="mt-1 whitespace-pre-wrap text-slate-700">{job.duties}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <CardTitle className="text-base">Licenses</CardTitle>
                  <span className="text-xs font-medium text-slate-500">{fullApplication.licenses.length}</span>
                </CardHeader>
                <CardContent className="pt-0 grid gap-2 text-sm">
                  {fullApplication.licenses.length === 0 && <p className="text-slate-400 italic">None recorded.</p>}
                  {fullApplication.licenses.map((lic) => {
                    const expired = lic.expiresAt && lic.expiresAt < new Date();
                    return (
                      <div key={lic.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                        <p className="font-semibold text-slate-900">{lic.type}{lic.licenseNumber ? ` · ${lic.licenseNumber}` : ""}</p>
                        <p className="text-slate-600 text-xs">{lic.issuingState ?? "—"} · Expires {formatDate(lic.expiresAt)}{expired && <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">EXPIRED</span>}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <CardTitle className="text-base">Certifications</CardTitle>
                  <span className="text-xs font-medium text-slate-500">{fullApplication.certifications.length}</span>
                </CardHeader>
                <CardContent className="pt-0 grid gap-2 text-sm">
                  {fullApplication.certifications.length === 0 && <p className="text-slate-400 italic">None recorded.</p>}
                  {fullApplication.certifications.map((c) => (
                    <div key={c.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      <p className="text-slate-600 text-xs">{c.issuer ?? "—"} · Expires {formatDate(c.expiresAt)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">References</CardTitle>
                <span className="text-xs font-medium text-slate-500">{fullApplication.references.length}</span>
              </CardHeader>
              <CardContent className="pt-0 grid gap-2 text-sm">
                {fullApplication.references.length === 0 && <p className="text-slate-400 italic">None recorded.</p>}
                {fullApplication.references.map((r) => (
                  <div key={r.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
                    <p className="font-semibold text-slate-900">{r.name}{r.relationship ? ` · ${r.relationship}` : ""}</p>
                    <p className="text-slate-600 text-xs">{[r.employer, r.phone, r.email].filter(Boolean).join(" · ") || "No contact details"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Pediatric Experience</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {profile.pediatricExperience ? (
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{profile.pediatricExperience}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">Applicant did not complete the pediatric experience section.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><FileText size={16} /> Documents</CardTitle>
                <span className="text-xs font-medium text-slate-500">{fullApplication.documents.length}</span>
              </CardHeader>
              <CardContent className="pt-0 grid gap-2 text-sm">
                {fullApplication.documents.length === 0 && <p className="text-slate-400 italic">No documents uploaded.</p>}
                {fullApplication.documents.map((doc) => (
                  <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 p-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{doc.fileName}</p>
                      <p className="text-slate-600 text-xs">{label(doc.detectedDocumentType ?? doc.documentType)} · {label(doc.processingStatus)}</p>
                    </div>
                    <DocumentPreviewLink documentId={doc.id} label="Preview" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* HR Internal Notes */}
            {!isReadOnly && (
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-3"><CardTitle className="text-base">HR Internal Notes</CardTitle></CardHeader>
                <CardContent className="pt-0 grid gap-3">
                  <p className="text-xs text-slate-600">Notes here are visible only to HR/Admin staff. Applicants never see these.</p>
                  <HRNoteForm applicationId={fullApplication.id} />
                  {fullApplication.hrNotes.length > 0 && (
                    <div className="grid gap-2 mt-2">
                      {fullApplication.hrNotes.map((note) => (
                        <div key={note.id} className="rounded-md border border-slate-100 bg-white p-2.5 text-sm">
                          <p className="text-slate-800 whitespace-pre-wrap">{note.note}</p>
                          <p className="mt-1 text-xs text-slate-500">{note.createdBy?.name ?? "—"} · {formatDate(note.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT */}
          <div className="grid gap-4">
            <Card className={hasReport ? "border-blue-200 bg-blue-50/50" : "border-dashed border-slate-300"}>
              <CardHeader className="pb-3"><CardTitle className="text-base">AI Review Verdict</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {!hasReport ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-600">No review has been run yet.</p>
                    {!isReadOnly && <p className="mt-1 text-xs text-slate-500">Click &ldquo;Run Review&rdquo; in the header above to generate.</p>}
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

            {(blockingIssues.length > 0 || warningIssues.length > 0) ? (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /> Open Issues</CardTitle></CardHeader>
                <CardContent className="pt-0 grid gap-2">
                  {blockingIssues.map((iss) => (
                    <div key={iss.id} className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm">
                      <p className="font-semibold text-red-900">{iss.section}{iss.fieldKey ? ` · ${iss.fieldKey}` : ""}</p>
                      <p className="text-red-800">{iss.message}</p>
                    </div>
                  ))}
                  {warningIssues.map((iss) => (
                    <div key={iss.id} className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm">
                      <p className="font-semibold text-amber-900">{iss.section}{iss.fieldKey ? ` · ${iss.fieldKey}` : ""}</p>
                      <p className="text-amber-800">{iss.message}</p>
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

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
              <CardContent className="pt-0 grid gap-2 text-sm">
                {fullApplication.statusHistory.length === 0 && <p className="text-slate-400 italic">No status changes yet.</p>}
                {fullApplication.statusHistory.map((h) => (
                  <div key={h.id} className="text-xs">
                    <p className="text-slate-700"><span className="font-medium">{label(h.fromStatus)}</span> → <span className="font-semibold">{label(h.toStatus)}</span></p>
                    <p className="text-slate-500">{h.changedBy?.name ?? "System"} · {formatDate(h.createdAt)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {fullApplication.decisions.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Decision History</CardTitle></CardHeader>
                <CardContent className="pt-0 grid gap-2 text-sm">
                  {fullApplication.decisions.map((d) => (
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

        {/* INTERVIEW SECTION */}
        {fullApplication.interviewRecords.length > 0 && (() => {
          const activeInterview = fullApplication.interviewRecords.find((iv) => iv.status === "scheduled" || iv.status === "pending");
          const lastInterview = fullApplication.interviewRecords[0];
          const showOutcomeForm = activeInterview && !isReadOnly && activeInterview.scheduledAt && activeInterview.scheduledAt < new Date(Date.now() + 60 * 60 * 1000);
          return (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="text-lg">Interview</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {activeInterview && activeInterview.scheduledAt && (
                  <div className="rounded-md border border-blue-200 bg-white p-3 text-sm">
                    <p className="font-semibold text-slate-900">Scheduled: {activeInterview.scheduledAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
                    {activeInterview.location && <p className="mt-1 text-slate-700">Location: {activeInterview.location}</p>}
                    <p className="mt-1 text-xs text-slate-500">Status: <span className="capitalize">{activeInterview.status}</span></p>
                  </div>
                )}
                {!activeInterview && lastInterview && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-900">Last interview {lastInterview.status}</p>
                    {lastInterview.scheduledAt && <p className="mt-1 text-xs text-slate-600">{lastInterview.scheduledAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>}
                  </div>
                )}
                {showOutcomeForm && activeInterview && (
                  <InterviewOutcomeForm applicationId={fullApplication.id} interviewId={activeInterview.id} />
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* AI ANALYSIS — run all AI checks at once */}
        {!isReadOnly && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">AI Analysis — review the results before deciding</CardTitle>
            </CardHeader>
            <CardContent>
              {!process.env.AI_API_KEY && !process.env.GROQ_API_KEY && !process.env.OPENROUTER_API_KEY ? (
                <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <strong>AI review unavailable.</strong> Add an API key (AI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY) to enable AI analysis. Rule-based review is still active.
                </div>
              ) : null}
              <AiAnalysisPanel applicationId={fullApplication.id} initialAiReport={aiReport ? {
                id: aiReport.id,
                status: aiReport.status,
                overallRiskLevel: aiReport.overallRiskLevel,
                recommendation: aiReport.recommendation,
                summary: aiReport.summary,
                findings: aiReport.findings.map((f) => ({ id: f.id, severity: f.severity, title: f.title, description: f.description }))
              } : null} />
            </CardContent>
          </Card>
        )}

        {/* TRAFFIC-LIGHT OUTCOME */}
        {!isReadOnly && (() => {
          const color = outcomeColorFor(fullApplication.status);
          const cls = colorClasses(color);
          return (
            <Card className={`border-2 ${cls.border} ${cls.bg}`}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full ${cls.dot}`} />
                  HR Outcome — current: <span className={cls.text}>{colorLabel(color)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HrOutcomeButtons applicationId={fullApplication.id} />
                <p className="mt-3 text-xs text-slate-600">PASS sends to verification / approved. NEEDS FINAL APPROVAL routes to the DON queue. FAIL closes the case at HR level. DON has the final word in any case.</p>
              </CardContent>
            </Card>
          );
        })()}

        {/* LEGACY DECISION PANEL (deeper actions like clarification, hold, interview) */}
        {!isReadOnly && (
          <details className="rounded-lg border border-slate-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700 hover:text-orange-700">More HR actions (clarification, hold, interview, etc.)</summary>
            <div className="border-t border-slate-100 p-4">
              <HRDecisionPanel applicationId={fullApplication.id} />
            </div>
          </details>
        )}
      </div>
    </DashboardShell>
  );
}
