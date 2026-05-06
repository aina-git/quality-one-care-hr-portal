"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeStepStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import {
  type CharacterReferenceData,
  type ReferenceContact,
  FCRA_AUTHORIZATION_STATEMENT,
  mergeCharacterReferenceData,
  validateCharacterReferenceForCompletion
} from "@/services/intake/characterReferenceSchema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CharacterReferenceStep(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CharacterReferenceData>(() => {
    const merged = mergeCharacterReferenceData(props.initialData);
    if (!merged.signatureName) merged.signatureName = props.applicantName;
    if (!merged.signatureDate) merged.signatureDate = new Date().toISOString().slice(0, 10);
    return merged;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);

  function update<K extends keyof CharacterReferenceData>(key: K, value: CharacterReferenceData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateReference(slot: "reference1" | "reference2" | "reference3", patch: Partial<ReferenceContact>) {
    setForm((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateCharacterReferenceForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/character_reference`, {
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
            <p className="font-semibold">References on file. FCRA authorization signed.</p>
            <p>HR will contact your references using the information provided.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4 text-xs italic text-slate-700">
          List your professional references below. After you sign the FCRA authorization, HR may either contact each reference directly using the form, or send each reference a copy of the Professional / Character Reference form to fill out and return. If you have already received completed reference responses, upload them on the
          <a href="/applicant/quick-upload" className="ml-1 font-semibold text-orange-700 hover:underline">Upload Documents</a> page.
        </CardContent>
      </Card>

      <ReferenceCard label="Reference #1" entry={form.reference1} onChange={(p) => updateReference("reference1", p)} required />
      <ReferenceCard label="Reference #2" entry={form.reference2} onChange={(p) => updateReference("reference2", p)} required />
      <ReferenceCard label="Reference #3 (optional but recommended)" entry={form.reference3} onChange={(p) => updateReference("reference3", p)} required={false} />

      <Card>
        <CardHeader><CardTitle>FCRA Authorization &amp; Signature</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            {FCRA_AUTHORIZATION_STATEMENT}
          </div>
          <label className="mt-3 inline-flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.fcraAuthorized} onChange={(e) => update("fcraAuthorized", e.target.checked)} />
            <span>I authorize Quality One Care to contact the references above and authorize each reference to disclose information about me to Quality One Care.</span>
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

function ReferenceCard({ label, entry, onChange, required }: { label: string; entry: ReferenceContact; onChange: (patch: Partial<ReferenceContact>) => void; required: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reference Full Name" required={required}><Input value={entry.fullName} onChange={(e) => onChange({ fullName: e.target.value })} /></Field>
          <Field label="Title / Position"><Input value={entry.titlePosition} onChange={(e) => onChange({ titlePosition: e.target.value })} /></Field>
          <Field label="Organization / Employer"><Input value={entry.organization} onChange={(e) => onChange({ organization: e.target.value })} /></Field>
          <Field label="Years known"><Input value={entry.yearsKnown} onChange={(e) => onChange({ yearsKnown: e.target.value })} /></Field>
          <Field label="Phone"><Input value={entry.phone} onChange={(e) => onChange({ phone: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={entry.email} onChange={(e) => onChange({ email: e.target.value })} /></Field>
          <Field label="In what capacity?" className="sm:col-span-2"><Input value={entry.capacityKnown} onChange={(e) => onChange({ capacityKnown: e.target.value })} placeholder="e.g. Direct supervisor for 3 years at MedStar" /></Field>
          <Field label="Best time to contact"><Input value={entry.bestTimeToContact} onChange={(e) => onChange({ bestTimeToContact: e.target.value })} /></Field>
        </div>
      </CardContent>
    </Card>
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
