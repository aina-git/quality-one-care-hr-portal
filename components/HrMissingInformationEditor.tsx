"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ValidationIssue } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCsrfHeaders } from "@/lib/csrf-client";
import { intakeFieldGroups } from "@/lib/intakeFieldOptions";

export function HrMissingInformationEditor({
  applicationId,
  issues
}: {
  applicationId: string;
  issues: ValidationIssue[];
}) {
  const router = useRouter();
  const [fieldKey, setFieldKey] = useState(issues.find((issue) => issue.fieldKey)?.fieldKey ?? "phone");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const activeIssue = useMemo(() => issues.find((issue) => issue.fieldKey === fieldKey), [issues, fieldKey]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setBusy(true);
      setMessage("");
      const response = await fetch(`/api/hr/applications/${applicationId}/manual-field`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ fieldKey, value, note })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Missing information could not be saved.");
        return;
      }
      setValue("");
      setNote("");
      setMessage("Saved. The application validation was refreshed.");
      router.refresh();
    } catch {
      setMessage("Missing information could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">HR Section Editor</p>
        <h3 className="mt-1 text-xl font-semibold text-slate-950">Complete missing application information</h3>
        <p className="mt-1 text-sm text-blue-900">
          Select any application section, enter the verified value, and save it to the applicant record. Every edit is audit logged.
        </p>
      </div>

      {issues.length ? (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-slate-950">Current unresolved items</p>
          <div className="grid gap-2 md:grid-cols-2">
            {issues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => issue.fieldKey && setFieldKey(issue.fieldKey)}
                className="rounded-xl border bg-white p-3 text-left text-sm transition hover:border-orange-300 hover:shadow-sm"
              >
                <span className="font-semibold text-slate-950">{issue.section}{issue.fieldKey ? ` - ${issue.fieldKey}` : ""}</span>
                <span className="mt-1 block text-slate-600">{issue.message}</span>
                <span className="mt-1 block text-xs text-orange-700">{issue.requiredAction ?? "Review and update this item."}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          No unresolved validation items are currently attached. HR can still edit a section if a correction is needed.
        </p>
      )}

      <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
          <select value={fieldKey ?? "phone"} onChange={(event) => setFieldKey(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
            {intakeFieldGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.fields.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </optgroup>
            ))}
          </select>
          <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Enter verified missing information" />
        </div>
        {activeIssue ? (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
            <p className="font-semibold">{activeIssue.message}</p>
            <p className="mt-1">Reason: {activeIssue.reason ?? "Not provided"}</p>
            <p>Responsible party: {activeIssue.responsibleParty ?? "Applicant or HR"}</p>
          </div>
        ) : null}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="rounded-md border bg-white px-3 py-2 text-sm"
          rows={3}
          placeholder="HR note or source, for example: verified from scanned application page 2"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save Verified Information"}</Button>
          {message ? <p className="text-sm font-medium text-orange-700">{message}</p> : null}
        </div>
      </form>
    </div>
  );
}
