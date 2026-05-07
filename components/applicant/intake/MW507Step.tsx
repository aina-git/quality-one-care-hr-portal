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
  type MW507Data,
  MD_COUNTIES,
  MW507_DOMICILE_STATES,
  MW507_PENALTY_STATEMENT,
  mergeMW507Data,
  validateMW507ForCompletion
} from "@/services/intake/mw507Schema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const selectClass = fieldClass;

export function MW507Step(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<MW507Data>(() => {
    const merged = mergeMW507Data(props.initialData);
    if (!merged.fullName) merged.fullName = props.applicantName;
    if (!merged.signatureName) merged.signatureName = props.applicantName;
    if (!merged.signatureDate) merged.signatureDate = new Date().toISOString().slice(0, 10);
    return merged;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);
  const [showSsn, setShowSsn] = useState(false);

  function update<K extends keyof MW507Data>(key: K, value: MW507Data[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateMW507ForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/mw507`, {
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
            <p className="font-semibold">MW507 on file.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4 text-xs italic text-slate-700">
          Maryland Form MW507 — Employee's Maryland Withholding Exemption Certificate. Complete this form so your employer can withhold the correct Maryland state and local income tax from your pay.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" required className="sm:col-span-2"><Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} /></Field>
            <Field label="Social Security Number" required>
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
            <Field label="County of Residence" required>
              <select className={selectClass} value={form.countyOfResidence} onChange={(e) => update("countyOfResidence", e.target.value)}>
                <option value="">Select…</option>
                {MD_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Address" required className="sm:col-span-2">
              <AddressAutocomplete
                value={form.address}
                onChange={(v) => update("address", v)}
                autoFillCombined={false}
                onSelectSuggestion={(s) => {
                  setForm((prev) => ({
                    ...prev,
                    address: s.street || prev.address,
                    cityStateZip: [s.city, [s.state, s.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
                    countyOfResidence: prev.countyOfResidence
                  }));
                }}
              />
            </Field>
            <Field label="City, State, ZIP" required className="sm:col-span-2"><Input value={form.cityStateZip} onChange={(e) => update("cityStateZip", e.target.value)} /></Field>
            <Field label="Maryland filing status" className="sm:col-span-2">
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={form.singleFilingMaryland} onChange={(e) => update("singleFilingMaryland", e.target.checked)} /> Single
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={form.marriedFilingMaryland} onChange={(e) => update("marriedFilingMaryland", e.target.checked)} /> Married
                </label>
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lines 1–2: Exemptions &amp; Additional Withholding</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Line 1 — Total number of exemptions claimed">
              <Input inputMode="numeric" value={form.line1Exemptions} onChange={(e) => update("line1Exemptions", e.target.value.replace(/\D/g, ""))} placeholder="0" />
            </Field>
            <Field label="Line 2 — Additional withholding per pay period">
              <Input inputMode="decimal" value={form.line2AdditionalPerPay} onChange={(e) => update("line2AdditionalPerPay", e.target.value)} placeholder="$" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lines 3–7: Claim of Exemption from Withholding</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-xs italic text-slate-500">
            Most employees skip this section. Only check a line if it specifically applies to you.
          </p>
          <div className="grid gap-3 text-sm">
            <ExemptionRow checked={form.line3NoMdLiability} onToggle={(v) => update("line3NoMdLiability", v)}>
              <strong>Line 3 — </strong>I had no Maryland income tax liability last year, I received a refund of all Maryland income tax withheld, and I expect to have no Maryland income tax liability this year.
            </ExemptionRow>
            <ExemptionRow checked={form.line4DomiciledOtherState} onToggle={(v) => update("line4DomiciledOtherState", v)}>
              <strong>Line 4 — </strong>I am domiciled in another state (Pennsylvania, Virginia, West Virginia, or Washington, D.C.) and qualify for exemption under the reciprocal agreement.
            </ExemptionRow>
            {form.line4DomiciledOtherState && (
              <Field label="State of domicile" required className="ml-6">
                <select className={selectClass} value={form.line4DomicileState} onChange={(e) => update("line4DomicileState", e.target.value)}>
                  <option value="">Select…</option>
                  {MW507_DOMICILE_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}
            <ExemptionRow checked={form.line5PennsylvaniaResident} onToggle={(v) => update("line5PennsylvaniaResident", v)}>
              <strong>Line 5 — </strong>I am domiciled in Pennsylvania and meet the conditions for the local tax adjustment.
            </ExemptionRow>
            <ExemptionRow checked={form.line6MilitarySpouseExempt} onToggle={(v) => update("line6MilitarySpouseExempt", v)}>
              <strong>Line 6 — </strong>I qualify for exemption as a nonresident military spouse under the federal Servicemembers Civil Relief Act.
            </ExemptionRow>
            <ExemptionRow checked={form.line7FederalExemptOccupation} onToggle={(v) => update("line7FederalExemptOccupation", v)}>
              <strong>Line 7 — </strong>My work is exempt from Maryland tax under federal law (specify reason below).
            </ExemptionRow>
            {form.line7FederalExemptOccupation && (
              <Field label="Federal-law basis" required className="ml-6">
                <Input value={form.line7Reason} onChange={(e) => update("line7Reason", e.target.value)} />
              </Field>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Signature</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            {MW507_PENALTY_STATEMENT}
          </div>
          <label className="mt-3 inline-flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.acknowledgesPenalty} onChange={(e) => update("acknowledgesPenalty", e.target.checked)} />
            <span>I acknowledge the declaration above and certify that the information on this MW507 is correct.</span>
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

function ExemptionRow({ checked, onToggle, children }: { checked: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
