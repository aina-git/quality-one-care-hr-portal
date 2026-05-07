"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeStepStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import {
  type W4Data,
  W4_FILING_STATUSES,
  W4_SIGNATURE_PENALTY,
  mergeW4Data,
  validateW4ForCompletion
} from "@/services/intake/w4Schema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function W4Step(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<W4Data>(() => {
    const merged = mergeW4Data(props.initialData);
    if (!merged.signatureName) merged.signatureName = props.applicantName;
    if (!merged.signatureDate) merged.signatureDate = new Date().toISOString().slice(0, 10);
    if (!merged.firstNameAndMI && !merged.lastName && props.applicantName) {
      const parts = props.applicantName.trim().split(/\s+/);
      if (parts.length === 1) {
        merged.firstNameAndMI = parts[0];
      } else if (parts.length >= 2) {
        merged.lastName = parts[parts.length - 1];
        merged.firstNameAndMI = parts.slice(0, -1).join(" ");
      }
    }
    return merged;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);
  const [showSsn, setShowSsn] = useState(false);

  function update<K extends keyof W4Data>(key: K, value: W4Data[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateW4ForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/w4`, {
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

  return (
    <div className="grid gap-5">
      {savedStatus === "completed" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-900">
            <p className="font-semibold">W-4 on file.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4 text-xs italic text-slate-700">
          IRS Form W-4 — Employee's Withholding Certificate (page 1 only). Complete this form so your employer can withhold the correct federal income tax from your pay.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Step 1: Enter Personal Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="(a) First name and middle initial" required>
              <Input value={form.firstNameAndMI} onChange={(e) => update("firstNameAndMI", e.target.value)} />
            </Field>
            <Field label="(a) Last name" required>
              <Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
            </Field>
            <Field label="(b) Social Security Number" required className="sm:col-span-2">
              <div className="flex gap-2">
                <Input
                  type={showSsn ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.ssn}
                  onChange={(e) => update("ssn", e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="123456789"
                />
                <Button type="button" variant="outline" onClick={() => setShowSsn((v) => !v)}>{showSsn ? "Hide" : "Show"}</Button>
              </div>
            </Field>
            <Field label="(a) Address" required className="sm:col-span-2">
              <AddressAutocomplete
                value={form.address}
                onChange={(v) => update("address", v)}
                autoFillCombined={false}
                onSelectSuggestion={(s) => {
                  setForm((prev) => ({
                    ...prev,
                    address: s.street || prev.address,
                    cityStateZip: [s.city, [s.state, s.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")
                  }));
                }}
              />
            </Field>
            <Field label="(a) City, state, ZIP" required className="sm:col-span-2"><Input value={form.cityStateZip} onChange={(e) => update("cityStateZip", e.target.value)} placeholder="Silver Spring, MD 20910" /></Field>
            <Field label="(c) Filing status" required className="sm:col-span-2">
              <div className="grid gap-2 text-sm">
                {W4_FILING_STATUSES.map((s) => (
                  <label key={s} className="inline-flex items-center gap-2">
                    <input type="radio" name="w4-fs" checked={form.filingStatus === s} onChange={() => update("filingStatus", s)} /> {s}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Step 2: Multiple Jobs or Spouse Works</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-xs italic text-slate-500">
            Complete Step 2 only if (1) you hold more than one job at a time, or (2) you are married filing jointly and your spouse also works. The correct amount of withholding depends on income earned from all of these jobs.
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-medium">Note:</span> The IRS recommends using the online Tax Withholding Estimator at <span className="text-orange-700">irs.gov/W4App</span> for the most accurate withholding (option 2(a)), or completing the Multiple Jobs Worksheet on page 3 of the W-4 PDF (option 2(b)). The simplest option (2(c)) is below:
          </p>
          <label className="mt-3 inline-flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.multipleJobsTwoJobsCheckbox} onChange={(e) => update("multipleJobsTwoJobsCheckbox", e.target.checked)} />
            <span>(c) Check this box if there are only two jobs total. The correct amount of withholding depends on income earned from all of these jobs.</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Step 3: Claim Dependents</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-xs italic text-slate-500">
            If your total income will be $200,000 or less ($400,000 or less if married filing jointly), you may claim the credit for qualifying children and other dependents.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Qualifying children under age 17 × $2,000">
              <Input inputMode="decimal" value={form.qualifyingChildrenAmount} onChange={(e) => update("qualifyingChildrenAmount", e.target.value)} placeholder="$" />
            </Field>
            <Field label="Other dependents × $500">
              <Input inputMode="decimal" value={form.otherDependentsAmount} onChange={(e) => update("otherDependentsAmount", e.target.value)} placeholder="$" />
            </Field>
            <Field label="Other credits (from estimator or other adjustments)">
              <Input inputMode="decimal" value={form.otherCredits} onChange={(e) => update("otherCredits", e.target.value)} placeholder="$" />
            </Field>
            <Field label="Total Step 3 amount">
              <Input inputMode="decimal" value={form.step3Total} onChange={(e) => update("step3Total", e.target.value)} placeholder="$" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Step 4 (optional): Other Adjustments</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="(a) Other income — annual amount">
              <Input inputMode="decimal" value={form.step4aOtherIncome} onChange={(e) => update("step4aOtherIncome", e.target.value)} placeholder="$" />
            </Field>
            <Field label="(b) Deductions — annual amount">
              <Input inputMode="decimal" value={form.step4bDeductions} onChange={(e) => update("step4bDeductions", e.target.value)} placeholder="$" />
            </Field>
            <Field label="(c) Extra withholding per pay period">
              <Input inputMode="decimal" value={form.step4cExtraWithholding} onChange={(e) => update("step4cExtraWithholding", e.target.value)} placeholder="$" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Step 5: Sign Here</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            {W4_SIGNATURE_PENALTY}
          </div>
          <label className="mt-3 inline-flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.acknowledgesPenalty} onChange={(e) => update("acknowledgesPenalty", e.target.checked)} />
            <span>I acknowledge the declaration above and certify that this W-4 is true, correct, and complete.</span>
          </label>
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
          <Button onClick={() => persist(true)} disabled={busy}>{busy ? "Submitting..." : "Submit & complete this step"}</Button>
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
