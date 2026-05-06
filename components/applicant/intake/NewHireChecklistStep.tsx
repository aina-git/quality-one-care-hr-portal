"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle, ExternalLink } from "lucide-react";
import type { IntakeStepStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import {
  type NewHireChecklistData,
  type StepSummary,
  NEW_HIRE_FINAL_ACKNOWLEDGEMENT,
  mergeNewHireChecklistData,
  validateNewHireChecklistForCompletion
} from "@/services/intake/newHireChecklistSchema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
  upstream: StepSummary[];
  uploadedDocCount: number;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NewHireChecklistStep(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<NewHireChecklistData>(() => {
    const merged = mergeNewHireChecklistData(props.initialData);
    if (!merged.signatureName) merged.signatureName = props.applicantName;
    if (!merged.signatureDate) merged.signatureDate = new Date().toISOString().slice(0, 10);
    return merged;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);

  function update<K extends keyof NewHireChecklistData>(key: K, value: NewHireChecklistData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAck(stepKey: string) {
    setForm((prev) => ({
      ...prev,
      acknowledgedSteps: { ...prev.acknowledgedSteps, [stepKey]: !prev.acknowledgedSteps[stepKey] }
    }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateNewHireChecklistForCompletion(form, props.upstream);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/new_hire_checklist`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ data: form, markCompleted })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save." });
        return;
      }
      setMessage({ tone: "ok", text: markCompleted ? "Application packet finalized — submitted to HR for review." : "Saved." });
      if (markCompleted) setSavedStatus("completed");
      router.refresh();
    } catch {
      setMessage({ tone: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  const upstream = props.upstream.filter((s) => s.def.key !== "new_hire_checklist");
  const allUpstreamDone = upstream.every((s) => s.status === "completed" || s.status === "refused" || s.status === "skipped");

  return (
    <div className="grid gap-5">
      {savedStatus === "completed" && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-900">
            <p className="font-semibold">Packet finalized.</p>
            <p>Your application is now with HR for review.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Final Step</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">New Hire Checklist</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tick each item below to confirm you have completed it, then sign the final acknowledgement. Once you submit, your application moves to HR for review.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Steps in your packet</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {upstream.map((step, idx) => {
              const isDone = step.status === "completed" || step.status === "refused" || step.status === "skipped";
              const ack = Boolean(form.acknowledgedSteps[step.def.key]);
              return (
                <div key={step.def.key} className={`flex items-start gap-3 rounded-md border p-3 ${isDone ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50"}`}>
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={ack}
                    disabled={!isDone}
                    onChange={() => toggleAck(step.def.key)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        <span className="text-slate-500">Step {idx + 1}.</span> {step.def.title}
                      </p>
                      <StatusChip status={step.status} />
                    </div>
                    {!isDone ? (
                      <Link href={`/applicant/intake/${step.def.key}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:underline">
                        Open this step <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">{step.def.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!allUpstreamDone && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5" />
              <span>Some steps above are not yet complete. Open each one and finish it before signing off here.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documents on file</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700">
            <span className="font-semibold tabular-nums">{props.uploadedDocCount}</span> document{props.uploadedDocCount === 1 ? "" : "s"} currently uploaded.
          </p>
          <Link href="/applicant/quick-upload" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-orange-700 hover:underline">
            Open Upload Documents <ExternalLink size={12} />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Final Acknowledgement</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            {NEW_HIRE_FINAL_ACKNOWLEDGEMENT}
          </div>
          <label className="mt-3 inline-flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.finalAcknowledgement} onChange={(e) => update("finalAcknowledgement", e.target.checked)} />
            <span>I acknowledge the final statement above.</span>
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Type your full legal name to sign" required><Input value={form.signatureName} onChange={(e) => update("signatureName", e.target.value)} /></Field>
            <Field label="Date" required><input type="date" className={fieldClass} value={form.signatureDate} onChange={(e) => update("signatureDate", e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => persist(false)} disabled={busy}>{busy ? "Saving..." : "Save draft"}</Button>
          <Button onClick={() => persist(true)} disabled={busy || !allUpstreamDone}>{busy ? "Submitting..." : "Finalize & submit application"}</Button>
          {message && <p className={message.tone === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children, required, className }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={`grid gap-1 text-sm ${className ?? ""}`}>
      <span className="font-medium text-slate-800">{label}{required ? <span className="ml-0.5 text-red-600">*</span> : null}</span>
      {children}
    </label>
  );
}

function StatusChip({ status }: { status: IntakeStepStatus }) {
  const tone = status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status === "refused" ? "border-amber-200 bg-amber-50 text-amber-800"
    : status === "skipped" ? "border-slate-200 bg-slate-50 text-slate-600"
    : status === "in_progress" ? "border-blue-200 bg-blue-50 text-blue-800"
    : "border-slate-300 bg-white text-slate-600";
  const label = status === "completed" ? "✓ Complete" : status.replace(/_/g, " ");
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}
