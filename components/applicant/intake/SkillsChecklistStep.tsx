"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeStepStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import {
  type CompetencyLevel,
  type SkillsChecklistData,
  SKILL_AREAS,
  mergeSkillsChecklistData,
  validateSkillsChecklistForCompletion
} from "@/services/intake/skillsChecklistSchema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
  inferredPosition: string;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass = "min-h-[60px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const LEVEL_OPTIONS: { value: CompetencyLevel; label: string; tone: string }[] = [
  { value: "independent", label: "Independent", tone: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  { value: "needs_supervision", label: "Needs supervision", tone: "border-amber-300 bg-amber-50 text-amber-900" },
  { value: "not_yet_competent", label: "Not yet competent", tone: "border-red-300 bg-red-50 text-red-900" },
  { value: "not_applicable", label: "N/A", tone: "border-slate-300 bg-slate-50 text-slate-700" }
];

export function SkillsChecklistStep(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<SkillsChecklistData>(() => {
    const merged = mergeSkillsChecklistData(props.initialData);
    if (!merged.employeeFullName) merged.employeeFullName = props.applicantName;
    if (!merged.position && props.inferredPosition) merged.position = props.inferredPosition;
    if (!merged.dateOfValidation) merged.dateOfValidation = new Date().toISOString().slice(0, 10);
    if (!merged.signatureName) merged.signatureName = props.applicantName;
    if (!merged.signatureDate) merged.signatureDate = new Date().toISOString().slice(0, 10);
    return merged;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);

  function update<K extends keyof SkillsChecklistData>(key: K, value: SkillsChecklistData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setRatingLevel(areaKey: string, level: CompetencyLevel) {
    setForm((prev) => ({ ...prev, ratings: { ...prev.ratings, [areaKey]: { ...prev.ratings[areaKey], level } } }));
  }

  function setRatingNotes(areaKey: string, notes: string) {
    setForm((prev) => ({ ...prev, ratings: { ...prev.ratings, [areaKey]: { ...prev.ratings[areaKey], notes } } }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateSkillsChecklistForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/skills_checklist`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ data: form, markCompleted })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save." });
        return;
      }
      setMessage({ tone: "ok", text: markCompleted ? "Submitted." : "Saved." });
      if (markCompleted) setSavedStatus("completed");
      router.refresh();
    } catch {
      setMessage({ tone: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  const ratedCount = Object.values(form.ratings).filter((r) => r.level).length;
  const totalCount = SKILL_AREAS.length;

  return (
    <div className="grid gap-5">
      {savedStatus === "completed" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-900">
            <p className="font-semibold">Self-assessment submitted.</p>
            <p>Your RN preceptor or DON will validate each skill at orientation.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4 text-xs italic text-slate-700">
          This is your <span className="font-semibold">self-assessment</span> for home health nursing skills used by Quality One Care. Be honest — the more accurately you self-rate, the better your preceptor can tailor orientation. Skills you mark "Not yet competent" or "Needs supervision" simply tell the preceptor where to focus during validation. Final validation by an RN preceptor or DON happens later, in person.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Employee Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee Full Name" required><Input value={form.employeeFullName} onChange={(e) => update("employeeFullName", e.target.value)} /></Field>
            <Field label="Position (RN / LPN / CNA / HHA)" required><Input value={form.position} onChange={(e) => update("position", e.target.value)} /></Field>
            <Field label="Employee ID (if assigned)"><Input value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)} /></Field>
            <Field label="Hire Date"><input type="date" className={fieldClass} value={form.hireDate} onChange={(e) => update("hireDate", e.target.value)} /></Field>
            <Field label="Clinical Specialty"><Input value={form.clinicalSpecialty} onChange={(e) => update("clinicalSpecialty", e.target.value)} /></Field>
            <Field label="Date of Self-Assessment"><input type="date" className={fieldClass} value={form.dateOfValidation} onChange={(e) => update("dateOfValidation", e.target.value)} /></Field>
            <Field label="Validation Type" className="sm:col-span-2">
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <RadioOption name="vt" label="Initial — orientation" checked={form.validationType === "initial"} onSelect={() => update("validationType", "initial")} />
                <RadioOption name="vt" label="Annual reassessment" checked={form.validationType === "annual"} onSelect={() => update("validationType", "annual")} />
                <RadioOption name="vt" label="Targeted — new skill" checked={form.validationType === "targeted"} onSelect={() => update("validationType", "targeted")} />
                <RadioOption name="vt" label="Remediation" checked={form.validationType === "remediation"} onSelect={() => update("validationType", "remediation")} />
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Skill Areas — Self-Assessment</span>
            <span className="text-sm font-normal tabular-nums text-slate-600">{ratedCount} of {totalCount} rated</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {SKILL_AREAS.map((area) => {
              const rating = form.ratings[area.key];
              return (
                <div key={area.key} className="rounded-md border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{area.title}</p>
                  <ul className="mt-1 grid gap-0.5 text-xs text-slate-500 list-disc list-inside">
                    {area.taskExamples.slice(0, 3).map((t, i) => <li key={i}>{t}</li>)}
                    {area.taskExamples.length > 3 && <li className="italic">+{area.taskExamples.length - 3} more tasks validated by preceptor…</li>}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {LEVEL_OPTIONS.map((opt) => {
                      const selected = rating.level === opt.value;
                      return (
                        <button
                          key={opt.value as string}
                          type="button"
                          onClick={() => setRatingLevel(area.key, opt.value)}
                          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${selected ? opt.tone : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <textarea className={`${textareaClass} mt-2`} value={rating.notes} onChange={(e) => setRatingNotes(area.key, e.target.value)} placeholder="Optional notes (e.g., specific equipment you've used, recent training, last patient setting)" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Employee Acknowledgement</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            I acknowledge that I have participated in this competency self-assessment. I have had the opportunity to ask questions and discuss any areas requiring further development. I understand that I am responsible for practicing only within the boundaries of my validated competencies and within my scope of practice.
          </div>
          <label className="mt-3 inline-flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.acknowledged} onChange={(e) => update("acknowledged", e.target.checked)} />
            <span>I acknowledge the statement above and certify that my self-ratings are accurate.</span>
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
          <Button onClick={() => persist(true)} disabled={busy}>{busy ? "Submitting..." : "Submit self-assessment"}</Button>
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

function RadioOption({ name, label, checked, onSelect }: { name: string; label: string; checked: boolean; onSelect: () => void }) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <input type="radio" name={name} checked={checked} onChange={onSelect} /> {label}
    </label>
  );
}
