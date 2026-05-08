import type { ValidationIssue } from "@prisma/client";
import { ValidationIssueActions } from "@/components/ValidationIssueActions";

export function ValidationChecklist({
  completionPercentage,
  blockingIssues,
  warningIssues,
  canSubmit,
  documents = []
}: {
  completionPercentage: number;
  blockingIssues: ValidationIssue[];
  warningIssues: ValidationIssue[];
  canSubmit: boolean;
  documents?: Array<{ id: string; fileName: string; documentType: string }>;
}) {
  return (
    <div className="grid gap-4 rounded-lg border bg-white p-4 shadow-sm">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Validation Complete</span>
          <span className="text-orange-700">{completionPercentage}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-orange-500" style={{ width: `${completionPercentage}%` }} />
        </div>
      </div>
      {blockingIssues.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-red-700">Items that need action before submission</p>
          <div className="mt-2 grid gap-2 text-sm text-slate-700">
            {blockingIssues.map((issue) => (
              <div key={issue.id} className="rounded-md border border-red-100 bg-red-50 p-3">
                <p className="font-semibold text-red-900">{issue.section}{issue.fieldKey ? ` - ${issue.fieldKey}` : ""}</p>
                <p className="mt-1">{issue.message}</p>
                <p className="mt-1 text-xs text-red-800">Reason: {issue.reason ?? issue.message}</p>
                <p className="text-xs text-red-800">What was checked: uploaded scanned applications, extracted fields, applicant corrections, manual entries, and linked supporting documents.</p>
                <p className="text-xs text-red-800">Required action: {issue.requiredAction ?? "Review and correct this item."}</p>
                <p className="text-xs text-red-800">Responsible party: {issue.responsibleParty ?? "Applicant"} - Flagged: {issue.flaggedAt.toLocaleDateString("en-US")}</p>
                <ValidationIssueActions issueId={issue.id} fieldKey={issue.fieldKey} documents={documents} />
              </div>
            ))}
          </div>
        </div>
      )}
      {warningIssues.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-orange-700">Warnings</p>
          <div className="mt-2 grid gap-2 text-sm text-slate-700">
            {warningIssues.map((issue) => (
              <div key={issue.id} className="rounded-md border border-orange-100 bg-orange-50 p-3">
                <p className="font-semibold text-orange-900">{issue.section}{issue.fieldKey ? ` - ${issue.fieldKey}` : ""}</p>
                <p className="mt-1">{issue.message}</p>
                <p className="mt-1 text-xs text-orange-800">Required action: {issue.requiredAction ?? "Review this item."}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {canSubmit && <p className="text-sm font-medium text-green-700">No required action items remain. This application is ready to submit.</p>}
    </div>
  );
}
