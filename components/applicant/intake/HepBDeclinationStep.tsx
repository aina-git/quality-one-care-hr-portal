"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeStepStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import {
  type HepBData,
  type HepBDose,
  HEP_B_OSHA_STATEMENT,
  emptyHepBDose,
  mergeHepBData,
  validateHepBForCompletion
} from "@/services/intake/hepBSchema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass = "min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function HepBDeclinationStep(props: Props) {
  const router = useRouter();
  const initialMerged = mergeHepBData(props.initialData);
  const [form, setForm] = useState<HepBData>(() => {
    const seeded: HepBData = { ...initialMerged };
    if (!seeded.employeeFullName) seeded.employeeFullName = props.applicantName;
    if (!seeded.dateOfDecision) seeded.dateOfDecision = new Date().toISOString().slice(0, 10);
    return seeded;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);

  function update<K extends keyof HepBData>(key: K, value: HepBData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateDose(slot: "dose1" | "dose2" | "dose3", patch: Partial<HepBDose>) {
    setForm((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateHepBForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const refused = markCompleted && form.decision === "decline";
      const body = refused
        ? {
            refused: true,
            refusalReason: "Hepatitis B vaccination declined per OSHA 29 CFR 1910.1030 Appendix A.",
            signatureName: form.signatureName,
            data: form
          }
        : { data: form, markCompleted };
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/hep_b_declination`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body)
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save." });
        return;
      }
      setMessage({ tone: "ok", text: markCompleted ? (refused ? "Recorded as declined." : "Submitted.") : "Saved." });
      if (markCompleted) setSavedStatus(refused ? "refused" : "completed");
      router.refresh();
    } catch {
      setMessage({ tone: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  function clearDoses() {
    update("dose1", emptyHepBDose());
    update("dose2", emptyHepBDose());
    update("dose3", emptyHepBDose());
  }

  return (
    <div className="grid gap-5">
      <Card className={savedStatus === "completed" ? "border-emerald-200 bg-emerald-50" : savedStatus === "refused" ? "border-amber-200 bg-amber-50" : "border-slate-200"}>
        <CardContent className="p-4 text-sm">
          <p className="text-xs italic text-slate-600">
            Required pursuant to the OSHA Bloodborne Pathogens Standard, 29 CFR 1910.1030. The declination language below is mandatory under federal regulation and may not be modified.
          </p>
          {savedStatus === "completed" && (
            <p className="mt-2 font-semibold text-emerald-900">This step is complete. You may still update your decision before final submission.</p>
          )}
          {savedStatus === "refused" && (
            <p className="mt-2 font-semibold text-amber-900">Declination on file. You may still update your decision before final submission.</p>
          )}
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
            <Field label="Date of Hire">
              <input type="date" className={fieldClass} value={form.dateOfHire} onChange={(e) => update("dateOfHire", e.target.value)} />
            </Field>
            <Field label="Date of Decision" required>
              <input type="date" className={fieldClass} value={form.dateOfDecision} onChange={(e) => update("dateOfDecision", e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Decision (choose one)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <DecisionRow
              label="Option A — I CONSENT to receive the Hepatitis B vaccine series."
              checked={form.decision === "consent"}
              onSelect={() => update("decision", "consent")}
              tone="emerald"
            />
            <DecisionRow
              label="Option B — I DECLINE the Hepatitis B vaccine at this time."
              checked={form.decision === "decline"}
              onSelect={() => { update("decision", "decline"); clearDoses(); }}
              tone="amber"
            />
            <DecisionRow
              label="Option C — I have already received the complete Hepatitis B vaccine series (proof attached)."
              checked={form.decision === "already_received"}
              onSelect={() => update("decision", "already_received")}
              tone="emerald"
            />
          </div>
        </CardContent>
      </Card>

      {form.decision === "consent" && (
        <Card>
          <CardHeader><CardTitle>Vaccination Record</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-xs italic text-slate-500">
              Complete this table as you receive each dose. You can save and return to update later.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-orange-100 text-left">
                    <th className="border border-orange-200 p-2 text-xs uppercase tracking-wide text-orange-900">Dose</th>
                    <th className="border border-orange-200 p-2 text-xs uppercase tracking-wide text-orange-900">Date Given</th>
                    <th className="border border-orange-200 p-2 text-xs uppercase tracking-wide text-orange-900">Lot #</th>
                    <th className="border border-orange-200 p-2 text-xs uppercase tracking-wide text-orange-900">Administered By</th>
                    <th className="border border-orange-200 p-2 text-xs uppercase tracking-wide text-orange-900">Next Date Due</th>
                  </tr>
                </thead>
                <tbody>
                  <DoseRow label="1st Dose" dose={form.dose1} onChange={(p) => updateDose("dose1", p)} />
                  <DoseRow label="2nd Dose" dose={form.dose2} onChange={(p) => updateDose("dose2", p)} />
                  <DoseRow label="3rd Dose" dose={form.dose3} onChange={(p) => updateDose("dose3", p)} />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {form.decision === "decline" && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader><CardTitle>Mandatory Declination Statement (OSHA 29 CFR 1910.1030 Appendix A)</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border border-amber-300 bg-white p-4 text-sm leading-relaxed text-slate-800">
              {HEP_B_OSHA_STATEMENT}
            </div>
            <label className="mt-3 inline-flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.acknowledgesDeclinationStatement}
                onChange={(e) => update("acknowledgesDeclinationStatement", e.target.checked)}
              />
              <span>I have read the OSHA declination statement above and acknowledge that I am declining the Hepatitis B vaccination at this time.</span>
            </label>
          </CardContent>
        </Card>
      )}

      {form.decision === "already_received" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader><CardTitle>Proof of Prior Vaccination</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">
              Please upload your Hepatitis B vaccination record (titer or completed-series proof) on the
              <a href="/applicant/quick-upload" className="ml-1 font-semibold text-orange-700 hover:underline">Upload Documents</a> page.
              You can add a brief note here if needed.
            </p>
            <label className="mt-3 grid gap-1 text-sm">
              <span className="font-medium">Note (optional)</span>
              <DictatableTextarea className={textareaClass} value={form.alreadyReceivedNote} onChange={(e) => update("alreadyReceivedNote", e.target.value)} placeholder="e.g. completed series in 2019 at MedStar; titer attached." />
            </label>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Employee Signature</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
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
          <Button onClick={() => persist(true)} disabled={busy}>
            {busy
              ? "Submitting..."
              : form.decision === "decline"
                ? "Submit declination"
                : "Submit & complete this step"}
          </Button>
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

function DecisionRow({ label, checked, onSelect, tone }: { label: string; checked: boolean; onSelect: () => void; tone: "emerald" | "amber" }) {
  const baseTone = checked
    ? tone === "amber"
      ? "border-amber-400 bg-amber-50"
      : "border-emerald-400 bg-emerald-50"
    : "border-slate-200 bg-white hover:bg-slate-50";
  return (
    <button type="button" onClick={onSelect} className={`flex items-start gap-3 rounded-md border p-3 text-left text-sm transition ${baseTone}`}>
      <input type="radio" checked={checked} onChange={onSelect} className="mt-0.5" />
      <span className="font-medium text-slate-900">{label}</span>
    </button>
  );
}

function DoseRow({ label, dose, onChange }: { label: string; dose: HepBDose; onChange: (patch: Partial<HepBDose>) => void }) {
  return (
    <tr>
      <td className="border border-slate-200 p-2 font-semibold text-slate-800">{label}</td>
      <td className="border border-slate-200 p-2"><input type="date" className={fieldClass} value={dose.dateGiven} onChange={(e) => onChange({ dateGiven: e.target.value })} /></td>
      <td className="border border-slate-200 p-2"><Input value={dose.lotNumber} onChange={(e) => onChange({ lotNumber: e.target.value })} /></td>
      <td className="border border-slate-200 p-2"><Input value={dose.administeredBy} onChange={(e) => onChange({ administeredBy: e.target.value })} /></td>
      <td className="border border-slate-200 p-2"><input type="date" className={fieldClass} value={dose.nextDateDue} onChange={(e) => onChange({ nextDateDue: e.target.value })} /></td>
    </tr>
  );
}
