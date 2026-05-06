"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeStepStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import {
  type JobDescriptionData,
  type JobDescriptionRole,
  JOB_DESCRIPTION_ACKNOWLEDGEMENT,
  getJobDescriptionContent,
  mergeJobDescriptionData,
  validateJobDescriptionForCompletion
} from "@/services/intake/jobDescriptionSchema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
  inferredRole: JobDescriptionRole | "";
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass = "min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function JobDescriptionStep(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<JobDescriptionData>(() => {
    const merged = mergeJobDescriptionData(props.initialData, props.inferredRole);
    if (!merged.signatureName) merged.signatureName = props.applicantName;
    if (!merged.signatureDate) merged.signatureDate = new Date().toISOString().slice(0, 10);
    return merged;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);

  const content = useMemo(() => (form.selectedRole ? getJobDescriptionContent(form.selectedRole) : null), [form.selectedRole]);

  function update<K extends keyof JobDescriptionData>(key: K, value: JobDescriptionData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateJobDescriptionForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/job_description`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ data: form, markCompleted })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save." });
        return;
      }
      setMessage({ tone: "ok", text: markCompleted ? "Acknowledged." : "Saved." });
      if (markCompleted) setSavedStatus("completed");
      router.refresh();
    } catch {
      setMessage({ tone: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      {savedStatus === "completed" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-900">
            <p className="font-semibold">Job description acknowledged.</p>
            <p>You may update your decision before final submission.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Which role are you applying for?</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-600">Select the role that matches your application. Quality One Care will show you the corresponding job description to read and acknowledge.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <RoleCard
              role="rn"
              label="Registered Nurse (RN)"
              description="Develops and supervises the plan of care; supervises LPNs, CNAs, and HHAs."
              selected={form.selectedRole === "rn"}
              onSelect={() => update("selectedRole", "rn")}
            />
            <RoleCard
              role="lpn"
              label="Licensed Practical Nurse (LPN)"
              description="Provides direct care under RN direction; supervises CNAs and HHAs."
              selected={form.selectedRole === "lpn"}
              onSelect={() => update("selectedRole", "lpn")}
            />
          </div>
        </CardContent>
      </Card>

      {content && (
        <>
          <Card>
            <CardHeader><CardTitle>{content.title}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-800">{content.positionSummary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Minimum Qualifications</CardTitle></CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm text-slate-800">
                {content.qualifications.map((q) => (
                  <li key={q.label} className="flex gap-2">
                    <span className="font-semibold text-slate-900">{q.label}:</span>
                    <span className="flex-1">{q.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Essential Duties &amp; Responsibilities</CardTitle></CardHeader>
            <CardContent>
              <ol className="grid gap-2 text-sm text-slate-800 list-decimal pl-6">
                {content.duties.map((d, i) => <li key={i}>{d}</li>)}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Physical Demands &amp; Working Conditions (ADA Essential Functions)</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-xs italic text-slate-500">Reasonable accommodations may be made to enable individuals with disabilities to perform the essential functions.</p>
              <ul className="grid gap-2 text-sm text-slate-800">
                {content.physicalDemands.map((d, i) => (
                  <li key={i} className="flex gap-2"><span className="text-orange-700">•</span><span>{d}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Acknowledgement</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
                {JOB_DESCRIPTION_ACKNOWLEDGEMENT}
              </div>
              <label className="mt-3 inline-flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={form.acknowledged} onChange={(e) => update("acknowledged", e.target.checked)} />
                <span>I have read and understood the {content.shortName} job description above.</span>
              </label>
              <div className="mt-4 grid gap-3 text-sm">
                <p className="font-medium text-slate-800">Are you able to perform the essential functions of this position?</p>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={form.ableToPerform === "yes"} onChange={() => update("ableToPerform", "yes")} />
                  <span>Yes, without accommodation</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={form.ableToPerform === "yes_with_accommodation"} onChange={() => update("ableToPerform", "yes_with_accommodation")} />
                  <span>Yes, with reasonable accommodation</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={form.ableToPerform === "no"} onChange={() => update("ableToPerform", "no")} />
                  <span>No — please contact HR</span>
                </label>
                {form.ableToPerform === "yes_with_accommodation" && (
                  <label className="grid gap-1">
                    <span className="font-medium">Describe the accommodation</span>
                    <textarea className={textareaClass} value={form.accommodationDescription} onChange={(e) => update("accommodationDescription", e.target.value)} />
                  </label>
                )}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Type your full legal name to sign <span className="text-red-600">*</span></span>
                  <Input value={form.signatureName} onChange={(e) => update("signatureName", e.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Date <span className="text-red-600">*</span></span>
                  <input type="date" className={fieldClass} value={form.signatureDate} onChange={(e) => update("signatureDate", e.target.value)} />
                </label>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => persist(false)} disabled={busy || !form.selectedRole}>{busy ? "Saving..." : "Save draft"}</Button>
          <Button onClick={() => persist(true)} disabled={busy || !form.selectedRole}>
            {busy ? "Submitting..." : "Acknowledge & complete this step"}
          </Button>
          {message && <p className={message.tone === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function RoleCard({ label, description, selected, onSelect }: { role: JobDescriptionRole; label: string; description: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`rounded-md border p-4 text-left transition ${selected ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
      <div className="flex items-center gap-2">
        <input type="radio" checked={selected} onChange={onSelect} />
        <span className="font-semibold text-slate-900">{label}</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </button>
  );
}
