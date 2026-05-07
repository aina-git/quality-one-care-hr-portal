"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeStepStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import { CLINICAL_TEST_QUESTIONS } from "@/services/intake/clinicalTestQuestions";
import {
  type ClinicalTestAnswerLetter,
  type ClinicalTestData,
  mergeClinicalTestData,
  validateClinicalTestForCompletion
} from "@/services/intake/clinicalTestSchema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
  applicantPosition: string;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PreEmploymentTestStep(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ClinicalTestData>(() => {
    const merged = mergeClinicalTestData(props.initialData);
    if (!merged.examineeName) merged.examineeName = props.applicantName;
    if (!merged.positionAppliedFor && props.applicantPosition) merged.positionAppliedFor = props.applicantPosition;
    if (!merged.testDate) merged.testDate = new Date().toISOString().slice(0, 10);
    if (!merged.signatureName) merged.signatureName = props.applicantName;
    if (!merged.signatureDate) merged.signatureDate = new Date().toISOString().slice(0, 10);
    return merged;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);

  const alreadyScored = form.scoreCorrect !== null && form.scoreTotal !== null;

  function update<K extends keyof ClinicalTestData>(key: K, value: ClinicalTestData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setAnswer(number: number, letter: ClinicalTestAnswerLetter) {
    setForm((prev) => ({ ...prev, answers: { ...prev.answers, [number]: letter } }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateClinicalTestForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/pre_employment_test`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ data: form, markCompleted })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save." });
        return;
      }
      if (payload.score) {
        setForm((prev) => ({
          ...prev,
          scoreCorrect: payload.score.correct,
          scoreTotal: payload.score.total,
          scorePercent: payload.score.percentage,
          passed: payload.score.passed,
          submittedAt: new Date().toISOString()
        }));
      }
      setMessage({ tone: "ok", text: markCompleted ? `Submitted. Score: ${payload.score?.correct ?? "?"} / ${payload.score?.total ?? "?"} (${payload.score?.percentage ?? "?"}%).` : "Saved." });
      if (markCompleted) setSavedStatus("completed");
      router.refresh();
    } catch {
      setMessage({ tone: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  const answeredCount = Object.values(form.answers).filter(Boolean).length;

  return (
    <div className="grid gap-5">
      {alreadyScored && (
        <Card className={form.passed ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}>
          <CardContent className="p-4">
            <p className={`text-base font-semibold ${form.passed ? "text-emerald-900" : "text-amber-900"}`}>
              {form.passed ? "Test passed" : "Test scored — below recommended threshold"}
            </p>
            <p className="mt-1 text-sm">
              Score: <span className="font-semibold tabular-nums">{form.scoreCorrect}</span> / {form.scoreTotal} ({form.scorePercent}%) — recommended threshold is 11/14 (78%).
            </p>
            <p className="mt-1 text-xs italic text-slate-600">
              You may revise your answers and re-submit; the latest score is kept on record. Final review is by HR / Director of Nursing.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4 text-xs italic text-slate-700">
          14-item assessment of clinical judgment in scenarios common to pediatric and adult home health nursing. Allow about 30 minutes. Closed-book — answer the best response. This step is normally last in the intake wizard.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Examinee Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (printed)" required><Input value={form.examineeName} onChange={(e) => update("examineeName", e.target.value)} /></Field>
            <Field label="Position Applied For"><Input value={form.positionAppliedFor} onChange={(e) => update("positionAppliedFor", e.target.value)} /></Field>
            <Field label="Date" required><input type="date" className={fieldClass} value={form.testDate} onChange={(e) => update("testDate", e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Test Items</span>
            <span className="text-sm font-normal tabular-nums text-slate-600">{answeredCount} of {CLINICAL_TEST_QUESTIONS.length} answered</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5">
            {CLINICAL_TEST_QUESTIONS.map((q) => {
              const selected = form.answers[q.number];
              return (
                <div key={q.number} className="rounded-md border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    <span className="text-orange-700">{q.number}.</span> {q.prompt}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {q.choices.map((ch) => {
                      const checked = selected === ch.letter;
                      return (
                        <label key={ch.letter} className={`flex items-start gap-2 rounded-md border p-2 text-sm cursor-pointer ${checked ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:bg-slate-50"}`}>
                          <input
                            type="radio"
                            name={`q-${q.number}`}
                            checked={checked}
                            onChange={() => setAnswer(q.number, ch.letter)}
                            className="mt-0.5"
                          />
                          <span><span className="font-semibold">{ch.letter}.</span> {ch.text}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Examinee Acknowledgement</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            I certify that the answers above are my own work and that I did not consult notes, references, or other persons during this assessment.
          </div>
          <label className="mt-3 inline-flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.honorAcknowledged} onChange={(e) => update("honorAcknowledged", e.target.checked)} />
            <span>I acknowledge the honor statement above.</span>
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
          <Button onClick={() => persist(true)} disabled={busy}>{busy ? "Submitting..." : "Submit & score"}</Button>
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
