"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeStepStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import {
  type WageDeductionData,
  WAGE_DEDUCTION_BULLETS,
  WAGE_DEDUCTION_LEGAL_BASIS,
  WAGE_DEDUCTION_OPENING,
  mergeWageDeductionData,
  validateWageDeductionForCompletion
} from "@/services/intake/wageDeductionSchema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function WageDeductionStep(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<WageDeductionData>(() => {
    const merged = mergeWageDeductionData(props.initialData);
    if (!merged.employeeFullName) merged.employeeFullName = props.applicantName;
    if (!merged.signatureName) merged.signatureName = props.applicantName;
    if (!merged.signatureDate) merged.signatureDate = new Date().toISOString().slice(0, 10);
    return merged;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);

  function update<K extends keyof WageDeductionData>(key: K, value: WageDeductionData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateWageDeductionForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/wage_deduction`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ data: form, markCompleted })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save." });
        return;
      }
      setMessage({ tone: "ok", text: markCompleted ? "Signed." : "Saved." });
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
            <p className="font-semibold">Wage deduction policy authorized.</p>
            <p>You may update before final submission.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4 text-xs italic text-slate-700">
          {WAGE_DEDUCTION_LEGAL_BASIS}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Employee Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee Full Name" required>
              <Input value={form.employeeFullName} onChange={(e) => update("employeeFullName", e.target.value)} />
            </Field>
            <Field label="Employee ID (if assigned)">
              <Input value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)} />
            </Field>
            <Field label="Position / Title">
              <Input value={form.positionTitle} onChange={(e) => update("positionTitle", e.target.value)} />
            </Field>
            <Field label="Department">
              <Input value={form.department} onChange={(e) => update("department", e.target.value)} />
            </Field>
          </div>
          <p className="mt-3 text-xs italic text-slate-500">
            The pay period, specific amount, and reason for any actual deduction will be filled in by HR at the time a deduction occurs and re-signed by you for that specific instance.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Acknowledgement &amp; Authorization</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-slate-800">{WAGE_DEDUCTION_OPENING}</p>
          <ul className="mt-3 grid gap-2 text-sm text-slate-800">
            {WAGE_DEDUCTION_BULLETS.map((b, i) => (
              <li key={i} className="flex gap-2"><span className="text-orange-700">•</span><span>{b}</span></li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3">
            <label className="inline-flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.acknowledgesAllBullets} onChange={(e) => update("acknowledgesAllBullets", e.target.checked)} />
              <span>I acknowledge the four terms of authorization above.</span>
            </label>
            <label className="inline-flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.acknowledgesDocumentationDuty} onChange={(e) => update("acknowledgesDocumentationDuty", e.target.checked)} />
              <span>I acknowledge that timely documentation completion is a core responsibility of my role and a condition of timely payment.</span>
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Type your full legal name to sign" required>
              <Input value={form.signatureName} onChange={(e) => update("signatureName", e.target.value)} />
            </Field>
            <Field label="Date" required>
              <input type="date" className={fieldClass} value={form.signatureDate} onChange={(e) => update("signatureDate", e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => persist(false)} disabled={busy}>{busy ? "Saving..." : "Save draft"}</Button>
          <Button onClick={() => persist(true)} disabled={busy}>{busy ? "Submitting..." : "Sign & complete this step"}</Button>
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
