"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeStepStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import {
  type PhysicalHealthData,
  type ImmunizationStatus,
  SECTION_7_ESSENTIAL_FUNCTIONS,
  mergePhysicalHealthData,
  validatePhysicalHealthForCompletion
} from "@/services/intake/physicalHealthSchema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
  applicantEmail: string;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass = "min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const IMMUNIZATION_FIELDS: { key: keyof PhysicalHealthData; label: string }[] = [
  { key: "hepatitisB", label: "Hepatitis B (3-dose series)" },
  { key: "influenza", label: "Influenza (current season)" },
  { key: "mmr", label: "Measles, Mumps, Rubella (MMR)" },
  { key: "varicella", label: "Varicella" },
  { key: "tdap", label: "Tdap (within 10 years)" },
  { key: "covid19", label: "COVID-19 (per current QOC policy)" }
];

export function PhysicalHealthStep(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<PhysicalHealthData>(() => {
    const merged = mergePhysicalHealthData(props.initialData);
    if (!merged.employeeFullName) merged.employeeFullName = props.applicantName;
    if (!merged.email) merged.email = props.applicantEmail;
    if (!merged.signatureName) merged.signatureName = props.applicantName;
    if (!merged.signatureDate) merged.signatureDate = new Date().toISOString().slice(0, 10);
    return merged;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);

  function update<K extends keyof PhysicalHealthData>(key: K, value: PhysicalHealthData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validatePhysicalHealthForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/physical_health`, {
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

  const examIsCompleted = form.examinationStatus === "completed";

  return (
    <div className="grid gap-5">
      {savedStatus === "completed" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-900">
            <p className="font-semibold">Medical clearance recorded.</p>
            <p>Ensure the provider-signed PDF is uploaded so HR can verify.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4 text-xs italic text-slate-700">
          This form is completed by a licensed healthcare provider after a fitness-for-duty examination, in compliance with the Americans with Disabilities Act (ADA). TB screening follows current CDC guidance for healthcare personnel. Fill in your own information here, take this form to your provider, then come back to record their findings and upload the signed PDF.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Section 1 — Employee Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" required><Input value={form.employeeFullName} onChange={(e) => update("employeeFullName", e.target.value)} /></Field>
            <Field label="Date of Birth" required><input type="date" className={fieldClass} value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} /></Field>
            <Field label="Position / Title"><Input value={form.positionTitle} onChange={(e) => update("positionTitle", e.target.value)} /></Field>
            <Field label="Department"><Input value={form.department} onChange={(e) => update("department", e.target.value)} /></Field>
            <Field label="Sex (assigned at birth)"><Input value={form.sexAtBirth} onChange={(e) => update("sexAtBirth", e.target.value)} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
            <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={(e) => update("address", e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
            <Field label="Date of Examination"><input type="date" className={fieldClass} value={form.dateOfExamination} onChange={(e) => update("dateOfExamination", e.target.value)} /></Field>
            <Field label="Known allergies" className="sm:col-span-2"><textarea className={textareaClass} value={form.knownAllergies} onChange={(e) => update("knownAllergies", e.target.value)} /></Field>
            <Field label="Current medications (name and dose)" className="sm:col-span-2"><textarea className={textareaClass} value={form.currentMedications} onChange={(e) => update("currentMedications", e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Examination Status</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <StatusOption label="I have not yet scheduled my examination" value="not_scheduled" current={form.examinationStatus} onSelect={() => update("examinationStatus", "not_scheduled")} />
            <StatusOption label="My examination is scheduled" value="scheduled" current={form.examinationStatus} onSelect={() => update("examinationStatus", "scheduled")} />
            <StatusOption label="Examination completed — I have results to record" value="completed" current={form.examinationStatus} onSelect={() => update("examinationStatus", "completed")} />
          </div>
        </CardContent>
      </Card>

      {examIsCompleted && (
        <>
          <Card>
            <CardHeader><CardTitle>Section 2 — Examining Provider</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Provider Name" required><Input value={form.providerName} onChange={(e) => update("providerName", e.target.value)} /></Field>
                <Field label="License # / NPI"><Input value={form.providerLicense} onChange={(e) => update("providerLicense", e.target.value)} /></Field>
                <Field label="Practice / Clinic"><Input value={form.providerPractice} onChange={(e) => update("providerPractice", e.target.value)} /></Field>
                <Field label="Phone"><Input value={form.providerPhone} onChange={(e) => update("providerPhone", e.target.value)} /></Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Section 4 — TB Screening</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-xs italic text-slate-500">Per CDC guidance for U.S. healthcare personnel, complete a baseline individual risk assessment, symptom screen, and TB testing (TST or IGRA) at hire.</p>
              <Field label="Test administered" required>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  <RadioOption name="tbTest" label="TST (Mantoux)" checked={form.tbTestType === "tst"} onSelect={() => update("tbTestType", "tst")} />
                  <RadioOption name="tbTest" label="IGRA (QuantiFERON / T-SPOT)" checked={form.tbTestType === "igra"} onSelect={() => update("tbTestType", "igra")} />
                  <RadioOption name="tbTest" label="Symptom screen only" checked={form.tbTestType === "symptom_only"} onSelect={() => update("tbTestType", "symptom_only")} />
                  <RadioOption name="tbTest" label="Refused / contraindicated" checked={form.tbTestType === "refused"} onSelect={() => update("tbTestType", "refused")} />
                </div>
              </Field>
              {form.tbTestType && form.tbTestType !== "refused" && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Test Date"><input type="date" className={fieldClass} value={form.tbTestDate} onChange={(e) => update("tbTestDate", e.target.value)} /></Field>
                  <Field label="Read / Result Date"><input type="date" className={fieldClass} value={form.tbReadDate} onChange={(e) => update("tbReadDate", e.target.value)} /></Field>
                  <Field label="Result" required>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                      <RadioOption name="tbResult" label="Negative" checked={form.tbResult === "negative"} onSelect={() => update("tbResult", "negative")} />
                      <RadioOption name="tbResult" label="Positive" checked={form.tbResult === "positive"} onSelect={() => update("tbResult", "positive")} />
                      <RadioOption name="tbResult" label="Indeterminate" checked={form.tbResult === "indeterminate"} onSelect={() => update("tbResult", "indeterminate")} />
                    </div>
                  </Field>
                  {form.tbTestType === "tst" && (
                    <Field label="Induration (mm)"><Input value={form.tbInductionMm} onChange={(e) => update("tbInductionMm", e.target.value)} /></Field>
                  )}
                  {form.tbResult === "positive" && (
                    <Field label="Chest X-ray date and result" className="sm:col-span-2"><textarea className={textareaClass} value={form.tbChestXrayResult} onChange={(e) => update("tbChestXrayResult", e.target.value)} /></Field>
                  )}
                  <Field label="Notes / follow-up plan" className="sm:col-span-2"><textarea className={textareaClass} value={form.tbNotes} onChange={(e) => update("tbNotes", e.target.value)} /></Field>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Section 5 — Communicable Disease Status</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <RadioOption name="freeOfCD" label="Yes — cleared" checked={form.freeOfCommunicableDisease === "yes"} onSelect={() => update("freeOfCommunicableDisease", "yes")} />
                <RadioOption name="freeOfCD" label="No — see TB notes above" checked={form.freeOfCommunicableDisease === "no"} onSelect={() => update("freeOfCommunicableDisease", "no")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Section 6 — Immunization Verification</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-xs italic text-slate-500">Per CDC ACIP recommendations for healthcare personnel.</p>
              <div className="grid gap-3">
                {IMMUNIZATION_FIELDS.map((row) => (
                  <ImmunizationRow
                    key={row.key as string}
                    label={row.label}
                    value={form[row.key] as ImmunizationStatus}
                    onSelect={(v) => update(row.key as keyof PhysicalHealthData, v as never)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Section 7 — Functional Capacity (informational)</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-xs italic text-slate-500">The provider certifies your ability to perform the essential functions, with or without accommodation:</p>
              <ul className="grid gap-2 text-sm text-slate-800">
                {SECTION_7_ESSENTIAL_FUNCTIONS.map((f, i) => (
                  <li key={i} className="flex gap-2"><span className="text-orange-700">•</span><span>{f}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Section 8 — Provider Determination</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm">
                <RadioOption name="determination" label="Cleared without restriction" checked={form.determination === "cleared"} onSelect={() => update("determination", "cleared")} />
                <RadioOption name="determination" label="Cleared with restriction (specify below)" checked={form.determination === "cleared_with_restriction"} onSelect={() => update("determination", "cleared_with_restriction")} />
                <RadioOption name="determination" label="Not cleared at this time (specify below)" checked={form.determination === "not_cleared"} onSelect={() => update("determination", "not_cleared")} />
              </div>
              {(form.determination === "cleared_with_restriction" || form.determination === "not_cleared") && (
                <Field label="Restrictions / accommodations recommended" required className="mt-3"><textarea className={textareaClass} value={form.restrictionsNotes} onChange={(e) => update("restrictionsNotes", e.target.value)} /></Field>
              )}
              <Field label="Date of next required reassessment" className="mt-3"><input type="date" className={fieldClass} value={form.nextReassessmentDate} onChange={(e) => update("nextReassessmentDate", e.target.value)} /></Field>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border-orange-200 bg-orange-50/40">
        <CardContent className="p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Upload the provider-signed PDF</p>
          <p className="mt-1">After your provider completes Sections 2–8 and signs, upload the scanned form on the
            <a href="/applicant/quick-upload" className="ml-1 font-semibold text-orange-700 hover:underline">Upload Documents</a> page so HR can verify.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Applicant Attestation</CardTitle></CardHeader>
        <CardContent>
          <label className="inline-flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.applicantAttestation} onChange={(e) => update("applicantAttestation", e.target.checked)} />
            <span>I attest that the information I have entered above is accurate and corresponds to the provider-signed form I will upload.</span>
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

function RadioOption({ name, label, checked, onSelect }: { name: string; label: string; checked: boolean; onSelect: () => void }) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <input type="radio" name={name} checked={checked} onChange={onSelect} /> {label}
    </label>
  );
}

function StatusOption({ label, value, current, onSelect }: { label: string; value: string; current: string; onSelect: () => void }) {
  const selected = current === value;
  return (
    <button type="button" onClick={onSelect} className={`flex items-start gap-3 rounded-md border p-3 text-left text-sm transition ${selected ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
      <input type="radio" checked={selected} onChange={onSelect} className="mt-0.5" />
      <span className="font-medium text-slate-900">{label}</span>
    </button>
  );
}

function ImmunizationRow({ label, value, onSelect }: { label: string; value: ImmunizationStatus; onSelect: (v: ImmunizationStatus) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <RadioOption name={`imm-${label}`} label="Up to date" checked={value === "up_to_date"} onSelect={() => onSelect("up_to_date")} />
        <RadioOption name={`imm-${label}`} label="In progress" checked={value === "in_progress"} onSelect={() => onSelect("in_progress")} />
        <RadioOption name={`imm-${label}`} label="Declined" checked={value === "declined"} onSelect={() => onSelect("declined")} />
      </div>
    </div>
  );
}
