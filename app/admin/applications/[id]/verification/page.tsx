import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2, ExternalLink, FileText } from "lucide-react";
import { CreateVerificationButton } from "@/components/CreateVerificationButton";
import { CrossValidationPanel } from "@/components/CrossValidationPanel";
import { DashboardShell } from "@/components/DashboardShell";
import { DocumentPreviewLink } from "@/components/DocumentPreviewLink";
import { FinalReviewSheet } from "@/components/FinalReviewSheet";
import { OigCheckButton } from "@/components/OigCheckButton";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { VerificationAssistantPanel } from "@/components/VerificationAssistantPanel";
import {
  buildAssistantUrlForCategory,
  getAssistantSourceForCategory
} from "@/services/verification/verificationAssistantService";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitToDonButton } from "@/components/SubmitToDonButton";
import { VerificationItemForm } from "@/components/VerificationItemForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminNav } from "@/lib/adminNav";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categoryCanExpire, describeBlockerReason, getVerificationChecklist, summarizeChecklist } from "@/services/verification/verificationService";
import { BlockerQuickFix } from "@/components/BlockerQuickFix";
import { CopyableLoginHint } from "@/components/CopyableLoginHint";
import { getVerificationLink } from "@/services/verification/verificationLinks";
import { splitMatchedAndUnmatchedDocuments } from "@/services/verification/documentMatchingService";

function label(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US");
}

function VerificationStatusBadge({ status }: { status: string }) {
  const tone =
    status === "verified" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
    status === "failed" || status === "expired" ? "border-red-200 bg-red-50 text-red-800" :
    status === "not_applicable" ? "border-slate-200 bg-slate-100 text-slate-600" :
    status === "pending_external_check" ? "border-blue-200 bg-blue-50 text-blue-800" :
    "border-amber-200 bg-amber-50 text-amber-800";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{label(status)}</span>;
}

const cgisCategory = "background_check_cgis";

export default async function AdminVerificationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["admin", "super_admin_hr", "executive_view_only"]);
  const { id } = await params;
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      applicantProfile: { include: { user: true } },
      documents: { orderBy: { createdAt: "desc" } },
      licenses: true
    }
  });
  if (!application) redirect("/admin/applications");

  const profile = application.applicantProfile;
  const photoDoc = profile.profilePhotoDocumentId
    ? await prisma.uploadedDocument.findUnique({ where: { id: profile.profilePhotoDocumentId }, select: { id: true, fileName: true } })
    : null;
  const checklist = await getVerificationChecklist(application.id);
  const summary = checklist ? summarizeChecklist(checklist) : null;
  const documents = application.documents.map((d) => ({ id: d.id, fileName: d.fileName, documentType: d.documentType, detectedDocumentType: d.detectedDocumentType }));
  const matched = checklist ? splitMatchedAndUnmatchedDocuments(documents, checklist.items) : { matched: [], unmatched: documents };
  const canEdit = user.role === "admin" || user.role === "super_admin_hr";
  const isReadOnly = user.role === "executive_view_only";

  return (
    <DashboardShell user={user} nav={adminNav}>
      <div className="grid gap-5">
        <div>
          <Link href={`/admin/applications/${application.id}/review`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to Application Review
          </Link>
        </div>

        {/* HEADER */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start gap-5">
              <ProfilePhoto document={photoDoc} viewerUserId={user.id} name={profile.user.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Verification Workspace</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{profile.user.name ?? profile.user.email}</h1>
                <p className="mt-1 text-sm text-slate-600">{application.desiredRole ?? "Role not recorded"}</p>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <StatusBadge status={application.status} />
                  {summary && <span className="text-sm font-semibold text-slate-700">{summary.completionPercentage}% complete</span>}
                  {summary && summary.missingItems.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{summary.missingItems.length} missing</span>}
                  {summary && summary.expiredItems.length > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">{summary.expiredItems.length} expired</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {checklist && summary?.readyForDon && canEdit && <SubmitToDonButton applicationId={application.id} />}
                {checklist && !summary?.readyForDon && canEdit && (
                  <p className="text-xs text-slate-500 max-w-[220px] text-right">Resolve missing/failed items below to enable DON submission.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {!checklist ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Verification not started</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-slate-600">Verification begins after HR approves the application for onboarding. Current status: <span className="font-medium">{label(application.status)}</span></p>
              {application.status === "approved" && canEdit && <CreateVerificationButton applicationId={application.id} />}
            </CardContent>
          </Card>
        ) : (
          <>
            {(() => {
              const verificationConcluded =
                checklist.status === "ready_for_don_review" ||
                checklist.status === "approved_by_don" ||
                checklist.status === "rejected_by_don";
              if (verificationConcluded) {
                const tone =
                  checklist.status === "approved_by_don" ? "border-emerald-300 bg-emerald-50" :
                  checklist.status === "rejected_by_don" ? "border-red-300 bg-red-50" :
                  "border-blue-300 bg-blue-50";
                const heading =
                  checklist.status === "approved_by_don" ? "Verification concluded — DON approved" :
                  checklist.status === "rejected_by_don" ? "Verification concluded — DON did not approve" :
                  "Verification concluded — submitted to DON for review";
                const body =
                  checklist.status === "approved_by_don" ? "All checklist items resolved. The DON has approved this applicant for hire." :
                  checklist.status === "rejected_by_don" ? "Verification was completed, but the DON did not approve. Open the DON decision to see the reason." :
                  "Verification is locked while the DON reviews this file.";
                return (
                  <Card className={tone}>
                    <CardContent className="p-4 flex flex-wrap items-start gap-3">
                      <CheckCircle2 size={18} className="mt-0.5 text-slate-700" />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{heading}</p>
                        <p className="mt-1 text-sm text-slate-700">{body}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              if (summary && summary.criticalBlockers.length > 0) {
                return (
                  <Card className="border-red-300 bg-red-50">
                    <CardContent className="p-4 flex items-start gap-3">
                      <AlertTriangle size={18} className="text-red-700 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-red-900">Critical blockers — cannot submit to DON</p>
                        <p className="mt-0.5 text-xs text-red-700">Click any item to enter a new expiration date or mark verified — without leaving this page.</p>
                        <ul className="mt-2 grid gap-1.5">
                          {summary.criticalBlockers.map((item) => (
                            <BlockerQuickFix
                              key={item.id}
                              itemId={item.id}
                              itemTitle={item.title}
                              reason={describeBlockerReason(item)}
                              applicationId={application.id}
                              canExpire={categoryCanExpire(item.category)}
                            />
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              if (summary && summary.criticalBlockers.length === 0 && summary.missingItems.length === 0) {
                return (
                  <Card className="border-emerald-200 bg-emerald-50">
                    <CardContent className="p-4 flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-700" />
                      <p className="text-sm font-semibold text-emerald-900">All required items verified or marked not applicable. Ready to submit to DON.</p>
                    </CardContent>
                  </Card>
                );
              }
              return null;
            })()}

            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-3"><CardTitle className="text-base">Automated identity cross-check</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <CrossValidationPanel applicationId={application.id} />
              </CardContent>
            </Card>

            {/* The 13-row Final Review Sheet — matches the paper form */}
            <FinalReviewSheet
              applicationId={application.id}
              applicantName={profile.user.name ?? profile.user.email}
              desiredRole={application.desiredRole}
              checklistItems={checklist.items.map((it) => ({
                id: it.id,
                category: it.category,
                title: it.title,
                status: it.status,
                result: it.result,
                notes: it.notes,
                expirationDate: it.expirationDate,
                externalReferenceNumber: it.externalReferenceNumber,
                source: it.source,
                verifiedAt: it.verifiedAt,
                verifiedByUser: it.verifiedByUser ? { id: it.verifiedByUser.id, name: it.verifiedByUser.name, email: it.verifiedByUser.email } : null,
                document: it.document ? { id: it.document.id, fileName: it.document.fileName } : null
              }))}
              documents={documents}
              canEdit={canEdit}
            />

            <details className="rounded-md border border-slate-200 bg-white">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700 hover:text-orange-700">Show detailed verification checklist (legacy view)</summary>
              <div className="border-t border-slate-100 p-3">
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">Verification Checklist</CardTitle>
                <span className="text-xs font-medium text-slate-500">{checklist.items.length} items</span>
              </CardHeader>
              <CardContent className="pt-0 grid gap-3">
                {checklist.items.map((item) => {
                  const link = getVerificationLink(item.category);
                  const suggestions = matched.matched.filter((m) => m.category === item.category).map((m) => m.document);
                  const assistantSource = getAssistantSourceForCategory(item.category);
                  const fullName = (profile.user.name ?? "").trim();
                  const [firstName, ...rest] = fullName.split(/\s+/);
                  const lastName = rest.length > 0 ? rest[rest.length - 1] : "";
                  const assistantConfig = assistantSource ? (() => {
                    const built = buildAssistantUrlForCategory(item.category, {
                      firstName: firstName ?? "",
                      lastName,
                      dateOfBirth: profile.dateOfBirth,
                      state: profile.state,
                      licenseNumber: application.licenses[0]?.licenseNumber ?? null,
                      licenseType: application.licenses[0]?.type ?? null,
                      licenseState: application.licenses[0]?.issuingState ?? null
                    });
                    if (!built) return null;
                    return {
                      category: item.category as string,
                      providerName: assistantSource.providerName,
                      description: assistantSource.description,
                      url: built.url,
                      copyText: built.copyText,
                      searchHints: assistantSource.searchHints,
                      captureFields: [...assistantSource.captureFields]
                    };
                  })() : null;
                  return (
                    <div key={item.id} className="rounded-md border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900">{item.title}</p>
                            <VerificationStatusBadge status={item.status} />
                            {item.expirationDate && item.expirationDate < new Date() && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">EXPIRED</span>}
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{item.requirement}</p>
                          {item.category === cgisCategory && (
                            <p className="mt-1 text-xs text-slate-500">Agency: Quality One Care Home Health Inc. · MA Provider Number: 420641000</p>
                          )}
                          {link && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <a href={link.searchUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:underline">
                                <ExternalLink size={12} /> Open {link.providerName}
                              </a>
                              {link.loginHint && <CopyableLoginHint email={link.loginHint} />}
                            </div>
                          )}
                          {item.notes && <p className="mt-2 text-sm text-slate-700">{item.notes}</p>}
                          {item.result && <p className="mt-1 text-sm text-slate-700">Result: {item.result}</p>}
                          {(item.document || suggestions.length > 0) && (
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {item.document && (
                                <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                                  <FileText size={12} className="text-slate-500" />
                                  <DocumentPreviewLink documentId={item.document.id} label={item.document.fileName} />
                                </div>
                              )}
                              {!item.document && suggestions.slice(0, 2).map((doc) => (
                                <div key={doc.id} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
                                  <span>Suggested:</span> <DocumentPreviewLink documentId={doc.id} label={doc.fileName} />
                                </div>
                              ))}
                            </div>
                          )}
                          {item.expirationDate && (
                            <p className="mt-2 text-xs text-slate-500">Expires: {formatDate(item.expirationDate)}</p>
                          )}
                          {item.verifiedByUser && item.verifiedAt && (
                            <p className="mt-1 text-xs text-slate-500">Verified by {item.verifiedByUser.name ?? item.verifiedByUser.email} · {formatDate(item.verifiedAt)}</p>
                          )}
                        </div>
                      </div>
                      {canEdit && item.category === "oig_exclusion" && (
                        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50/40 p-3">
                          <p className="text-xs font-semibold text-blue-900 mb-2">Automated verification</p>
                          <OigCheckButton applicationId={application.id} />
                        </div>
                      )}
                      {canEdit && assistantConfig && (
                        <div className="mt-3">
                          <VerificationAssistantPanel applicationId={application.id} itemId={item.id} config={assistantConfig} />
                        </div>
                      )}
                      {canEdit && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-medium text-orange-700 hover:underline">Update item directly</summary>
                          <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 p-3">
                            <VerificationItemForm itemId={item.id} category={item.category} currentStatus={item.status} documents={documents} />
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
              </div>
            </details>

            {matched.unmatched.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Uploaded documents not yet attached to a checklist item</CardTitle></CardHeader>
                <CardContent className="pt-0 grid gap-2 text-sm">
                  {matched.unmatched.map((doc) => (
                    <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 p-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{doc.fileName}</p>
                        <p className="text-xs text-slate-500">{label(doc.detectedDocumentType ?? doc.documentType)}</p>
                      </div>
                      <DocumentPreviewLink documentId={doc.id} label="Preview" />
                    </div>
                  ))}
                  <p className="mt-1 text-xs text-slate-500">Open the relevant checklist item above and use &ldquo;Update item&rdquo; to attach.</p>
                </CardContent>
              </Card>
            )}

            {summary?.readyForDon && canEdit && (
              <Card className="border-emerald-200 bg-emerald-50/40">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-emerald-900">Ready for DON final approval</p>
                    <p className="text-xs text-emerald-700">Submitting will move the case to the DON approval queue.</p>
                  </div>
                  <SubmitToDonButton applicationId={application.id} />
                </CardContent>
              </Card>
            )}

            {isReadOnly && (
              <p className="text-xs text-slate-500 italic text-center">You have read-only access to this verification record.</p>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
