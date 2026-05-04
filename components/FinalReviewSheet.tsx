import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, Circle, ExternalLink, FileText } from "lucide-react";
import { DocumentPreviewLink } from "@/components/DocumentPreviewLink";
import { OigCheckButton } from "@/components/OigCheckButton";
import { VerificationItemForm } from "@/components/VerificationItemForm";
import { FINAL_REVIEW_ROWS, AGENCY_INFO } from "@/lib/finalReviewChecklist";
import type { VerificationCategory, VerificationItemStatus } from "@prisma/client";

type ChecklistItem = {
  id: string;
  category: VerificationCategory;
  title: string;
  status: VerificationItemStatus;
  result: string | null;
  notes: string | null;
  expirationDate: Date | null;
  externalReferenceNumber: string | null;
  source: string | null;
  verifiedAt: Date | null;
  verifiedByUser: { id: string; name: string | null; email: string } | null;
  document: { id: string; fileName: string } | null;
};

type Document = { id: string; fileName: string; documentType: string; detectedDocumentType: string | null };

const AUTONOMOUS_CATEGORIES = new Set<VerificationCategory>(["oig_exclusion"]);

function statusOf(items: ChecklistItem[]): VerificationItemStatus {
  if (items.length === 0) return "not_started";
  // worst-case wins: any failed/expired beats verified/pending; not_applicable equivalent to clear
  const order: VerificationItemStatus[] = ["expired", "failed", "needs_followup", "pending_external_check", "pending", "not_started", "verified", "not_applicable"];
  for (const target of order) {
    if (items.some((i) => i.status === target)) return target;
  }
  return items[0]?.status ?? "not_started";
}

function statusVisual(status: VerificationItemStatus) {
  switch (status) {
    case "verified":
      return { Icon: CheckCircle2, label: "Verified", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
    case "failed":
      return { Icon: XCircle, label: "Failed", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" };
    case "expired":
      return { Icon: XCircle, label: "Expired", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" };
    case "needs_followup":
      return { Icon: AlertTriangle, label: "Needs follow-up", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" };
    case "pending_external_check":
      return { Icon: AlertTriangle, label: "External check pending", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" };
    case "not_applicable":
      return { Icon: Circle, label: "Not applicable", color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200" };
    case "pending":
    case "not_started":
    default:
      return { Icon: Circle, label: "Pending", color: "text-slate-400", bg: "bg-white", border: "border-slate-200" };
  }
}

function formatDate(d: Date | null): string {
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export function FinalReviewSheet({
  applicationId,
  applicantName,
  desiredRole,
  checklistItems,
  documents,
  canEdit
}: {
  applicationId: string;
  applicantName: string;
  desiredRole: string | null;
  checklistItems: ChecklistItem[];
  documents: Document[];
  canEdit: boolean;
}) {
  // Index checklist items by category for fast lookup
  const itemsByCategory = new Map<VerificationCategory, ChecklistItem[]>();
  for (const item of checklistItems) {
    const arr = itemsByCategory.get(item.category) ?? [];
    arr.push(item);
    itemsByCategory.set(item.category, arr);
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-sm">
      {/* Header — matches the paper form heading + agency block */}
      <div className="border-b-2 border-slate-300 bg-slate-50 px-6 py-4 text-center">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">TABLE OF CHECKLIST FOR EMPLOYMENT VERIFICATION</h2>
        <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-slate-700 sm:grid-cols-3">
          <div><span className="font-semibold">Agency:</span> {AGENCY_INFO.name}</div>
          <div><span className="font-semibold">MA Provider Number:</span> {AGENCY_INFO.maProviderNumber}</div>
          <div><span className="font-semibold">Verification email:</span> {AGENCY_INFO.verificationEmail}</div>
        </div>
        <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-slate-700 sm:grid-cols-2">
          <div><span className="font-semibold">Applicant:</span> {applicantName}</div>
          <div><span className="font-semibold">Role:</span> {desiredRole ?? "—"}</div>
        </div>
      </div>

      {/* The 13-row table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-300 px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 w-10">#</th>
              <th className="border border-slate-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700">Checklist Item</th>
              <th className="border border-slate-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 w-40">Status</th>
              <th className="border border-slate-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 w-32">Date Verified</th>
              <th className="border border-slate-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 w-40">Verifier</th>
              <th className="border border-slate-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700">Reference / Evidence / Notes</th>
            </tr>
          </thead>
          <tbody>
            {FINAL_REVIEW_ROWS.map((row) => {
              const items = row.categories.flatMap((cat) => itemsByCategory.get(cat) ?? []);
              const aggregateStatus = statusOf(items);
              const visual = statusVisual(aggregateStatus);
              const earliestExpiration = items.map((i) => i.expirationDate).filter(Boolean).sort((a, b) => (a as Date).getTime() - (b as Date).getTime())[0] as Date | null;
              const lastVerifiedAt = items.map((i) => i.verifiedAt).filter(Boolean).sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] as Date | null;
              const verifiers = items.map((i) => i.verifiedByUser).filter(Boolean) as Array<{ name: string | null; email: string }>;
              const verifierName = verifiers[0]?.name ?? verifiers[0]?.email ?? "—";
              const refs = items.map((i) => i.externalReferenceNumber).filter(Boolean) as string[];
              const evidenceDocs = items.map((i) => i.document).filter(Boolean) as Array<{ id: string; fileName: string }>;
              const result = items.map((i) => i.result).filter(Boolean).join(" | ");
              const notes = items.map((i) => i.notes).filter(Boolean).join(" | ");
              const isAuto = row.autonomous === "oig";

              return (
                <tr key={row.index} className={visual.bg}>
                  <td className="border border-slate-300 px-2 py-3 text-center align-top font-bold text-slate-700">{row.index}</td>
                  <td className="border border-slate-300 px-3 py-3 align-top">
                    <p className="font-semibold text-slate-900">{row.title}</p>
                    {row.description && <p className="mt-1 text-xs text-slate-600">{row.description}</p>}
                    {isAuto && canEdit && (
                      <div className="mt-2">
                        <OigCheckButton applicationId={applicationId} />
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-300 px-3 py-3 align-top">
                    <div className={`inline-flex items-center gap-1.5 rounded-full border ${visual.border} bg-white px-2 py-0.5 text-xs font-semibold ${visual.color}`}>
                      <visual.Icon size={12} /> {visual.label}
                    </div>
                  </td>
                  <td className="border border-slate-300 px-3 py-3 align-top text-xs text-slate-700">{formatDate(lastVerifiedAt)}</td>
                  <td className="border border-slate-300 px-3 py-3 align-top text-xs text-slate-700">{verifierName}</td>
                  <td className="border border-slate-300 px-3 py-3 align-top text-xs text-slate-700">
                    {result && <p className="text-slate-800">{result}</p>}
                    {refs.length > 0 && <p className="mt-0.5 font-mono text-[11px] text-slate-500">{refs.join(", ")}</p>}
                    {evidenceDocs.length > 0 && (
                      <div className="mt-1 grid gap-0.5">
                        {evidenceDocs.map((doc) => (
                          <span key={doc.id} className="inline-flex items-center gap-1">
                            <FileText size={10} className="text-slate-500" />
                            <DocumentPreviewLink documentId={doc.id} label={doc.fileName} />
                          </span>
                        ))}
                      </div>
                    )}
                    {earliestExpiration && <p className="mt-0.5 text-[11px] text-slate-500">Expires: {formatDate(earliestExpiration)}</p>}
                    {notes && <p className="mt-0.5 italic text-slate-500">{notes}</p>}
                    {canEdit && items.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] font-medium text-orange-700 hover:underline">Update</summary>
                        <div className="mt-1 rounded border border-slate-200 bg-white p-2">
                          <VerificationItemForm
                            itemId={items[0].id}
                            category={items[0].category}
                            currentStatus={items[0].status}
                            documents={documents}
                          />
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
        After background check (CGIS) is done and the receipt is sent, verify the receipt and email it to {AGENCY_INFO.verificationEmail}. The applicant&apos;s name on the form must match the name on the CGIS receipt. Reference the agency MA Provider Number {AGENCY_INFO.maProviderNumber} in your communications.
      </p>
    </div>
  );
}
