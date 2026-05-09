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
  type W9Data,
  W9_CERTIFICATION,
  W9_LLC_TAX_CLASSIFICATIONS,
  W9_TAX_CLASSIFICATIONS,
  mergeW9Data,
  validateW9ForCompletion
} from "@/services/intake/w9Schema";

type PrefillAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
  fullName: string;
} | null;

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
  prefillAddress?: PrefillAddress;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass = "min-h-[60px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function W9Step(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<W9Data>(() => {
    const merged = mergeW9Data(props.initialData);
    const prefill = props.prefillAddress;
    if (!merged.fullName) merged.fullName = prefill?.fullName || props.applicantName;
    if (!merged.signatureName) merged.signatureName = prefill?.fullName || props.applicantName;
    if (!merged.signatureDate) merged.signatureDate = new Date().toISOString().slice(0, 10);
    if (!merged.addressStreet && prefill?.street) merged.addressStreet = prefill.street;
    if (!merged.addressCityStateZip && prefill) {
      const cityStateZip = [prefill.city, [prefill.state, prefill.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      if (cityStateZip) merged.addressCityStateZip = cityStateZip;
    }
    return merged;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);
  const [showSsn, setShowSsn] = useState(false);

  function update<K extends keyof W9Data>(key: K, value: W9Data[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateW9ForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/w9`, {
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
            <p className="font-semibold">W-9 on file.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4 text-xs italic text-slate-700">
          IRS Form W-9 — Request for Taxpayer Identification Number and Certification (page 1 only). Use this form to give Quality One Care your correct TIN.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lines 1–4: Name &amp; Classification</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Field label="Line 1 — Name (as shown on your income tax return)" required>
              <Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
            </Field>
            <Field label="Line 2 — Business name / disregarded entity (if different from Line 1)">
              <Input value={form.businessName} onChange={(e) => update("businessName", e.target.value)} />
            </Field>
            <Field label="Line 3 — Federal tax classification" required>
              <div className="grid gap-2 text-sm">
                {W9_TAX_CLASSIFICATIONS.map((c) => (
                  <label key={c} className="inline-flex items-center gap-2">
                    <input type="radio" name="w9-class" checked={form.taxClassification === c} onChange={() => update("taxClassification", c)} /> {c}
                  </label>
                ))}
              </div>
            </Field>
            {form.taxClassification === "Limited liability company" && (
              <Field label="LLC tax classification (C = C corp, S = S corp, P = partnership)" required>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  {W9_LLC_TAX_CLASSIFICATIONS.map((c) => (
                    <label key={c} className="inline-flex items-center gap-1.5">
                      <input type="radio" name="w9-llc" checked={form.llcTaxClassification === c} onChange={() => update("llcTaxClassification", c)} /> {c}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            {form.taxClassification === "Other" && (
              <Field label="If 'Other', describe" required>
                <Input value={form.otherClassificationDescription} onChange={(e) => update("otherClassificationDescription", e.target.value)} />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Line 4 — Exempt payee code (if any)">
                <Input value={form.exemptPayeeCode} onChange={(e) => update("exemptPayeeCode", e.target.value)} />
              </Field>
              <Field label="Line 4 — Exemption from FATCA reporting code (if any)">
                <Input value={form.fatcaExemptionCode} onChange={(e) => update("fatcaExemptionCode", e.target.value)} />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lines 5–7: Address</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Field label="Line 5 — Street address (number, street, apt/suite)" required>
              <AddressAutocomplete
                value={form.addressStreet}
                onChange={(v) => update("addressStreet", v)}
                autoFillCombined={false}
                onSelectSuggestion={(s) => {
                  setForm((prev) => ({
                    ...prev,
                    addressStreet: s.street || prev.addressStreet,
                    addressCityStateZip: [s.city, [s.state, s.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")
                  }));
                }}
              />
            </Field>
            <Field label="Line 6 — City, state, ZIP" required>
              <Input value={form.addressCityStateZip} onChange={(e) => update("addressCityStateZip", e.target.value)} placeholder="Silver Spring, MD 20910" />
            </Field>
            <Field label="Line 7 — Requester's name and address (pre-filled)">
              <DictatableTextarea className={textareaClass} value={form.requesterNameAddress} onChange={(e) => update("requesterNameAddress", e.target.value)} />
            </Field>
            <Field label="Account number(s) (optional)">
              <Input value={form.accountNumbers} onChange={(e) => update("accountNumbers", e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Part I — Taxpayer Identification Number (TIN)</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-xs italic text-slate-500">
            Enter your TIN in the appropriate box. For individuals, this is your Social Security Number (SSN). For most entities, it is the Employer Identification Number (EIN).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="TIN type" required>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name="w9-tin" checked={form.tinType === "ssn"} onChange={() => update("tinType", "ssn")} /> Social Security Number
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="radio" name="w9-tin" checked={form.tinType === "ein"} onChange={() => update("tinType", "ein")} /> Employer Identification Number
                </label>
              </div>
            </Field>
            {form.tinType === "ssn" && (
              <Field label="SSN (9 digits)" required>
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
            )}
            {form.tinType === "ein" && (
              <Field label="EIN (9 digits)" required>
                <Input
                  inputMode="numeric"
                  value={form.ein}
                  onChange={(e) => update("ein", e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="123456789"
                />
              </Field>
            )}
          </div>
          <label className="mt-4 inline-flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.notSubjectToBackupWithholding} onChange={(e) => update("notSubjectToBackupWithholding", e.target.checked)} />
            <span>I am NOT currently subject to backup withholding (leave unchecked only if the IRS has notified you that you are subject to backup withholding for failure to report all interest or dividends).</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Part II — Certification</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            {W9_CERTIFICATION}
          </div>
          <label className="mt-3 inline-flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.certified} onChange={(e) => update("certified", e.target.checked)} />
            <span>I certify the four statements above under penalty of perjury.</span>
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
