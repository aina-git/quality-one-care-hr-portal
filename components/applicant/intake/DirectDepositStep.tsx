"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeStepStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import {
  type DirectDepositAccount,
  type DirectDepositData,
  DIRECT_DEPOSIT_AUTHORIZATION,
  mergeDirectDepositData,
  validateDirectDepositForCompletion
} from "@/services/intake/directDepositSchema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantName: string;
  applicantEmail: string;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DirectDepositStep(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<DirectDepositData>(() => {
    const merged = mergeDirectDepositData(props.initialData);
    if (!merged.employeeFullName) merged.employeeFullName = props.applicantName;
    if (!merged.email) merged.email = props.applicantEmail;
    if (!merged.signatureName) merged.signatureName = props.applicantName;
    if (!merged.signatureDate) merged.signatureDate = new Date().toISOString().slice(0, 10);
    return merged;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [savedStatus, setSavedStatus] = useState<IntakeStepStatus>(props.initialStatus);

  function update<K extends keyof DirectDepositData>(key: K, value: DirectDepositData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateAccount(slot: "primary" | "secondary", patch: Partial<DirectDepositAccount>) {
    setForm((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateDirectDepositForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/direct_deposit`, {
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

  const isCancel = form.action === "cancel";

  return (
    <div className="grid gap-5">
      {savedStatus === "completed" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-900">
            <p className="font-semibold">Direct deposit authorization on file.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Employee Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee Full Name" required><Input value={form.employeeFullName} onChange={(e) => update("employeeFullName", e.target.value)} /></Field>
            <Field label="Employee ID (if assigned)"><Input value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)} /></Field>
            <Field label="Position / Title"><Input value={form.positionTitle} onChange={(e) => update("positionTitle", e.target.value)} /></Field>
            <Field label="Department"><Input value={form.department} onChange={(e) => update("department", e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Action Requested</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <RadioOption name="dd-action" label="New enrollment" checked={form.action === "new"} onSelect={() => update("action", "new")} />
            <RadioOption name="dd-action" label="Change account information" checked={form.action === "change"} onSelect={() => update("action", "change")} />
            <RadioOption name="dd-action" label="Cancel direct deposit" checked={form.action === "cancel"} onSelect={() => update("action", "cancel")} />
          </div>
          <Field label="Effective pay date (optional — defaults to next available pay period)" className="mt-3">
            <input type="date" className={fieldClass} value={form.effectivePayDate} onChange={(e) => update("effectivePayDate", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {!isCancel && form.action && (
        <>
          <AccountCard
            label="Primary Account (Account 1)"
            account={form.primary}
            onChange={(p) => updateAccount("primary", p)}
            allowRemainder={false}
          />

          <Card>
            <CardContent className="p-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.useSecondary} onChange={(e) => update("useSecondary", e.target.checked)} />
                <span>I want to split my deposit between two accounts (add a secondary account)</span>
              </label>
            </CardContent>
          </Card>

          {form.useSecondary && (
            <AccountCard
              label="Secondary Account (Account 2)"
              account={form.secondary}
              onChange={(p) => updateAccount("secondary", p)}
              allowRemainder
            />
          )}

          <Card className="border-orange-200 bg-orange-50/40">
            <CardHeader><CardTitle>Required Attachment</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700">
                For each account above, attach <span className="font-medium">one</span> of the following on the
                <a href="/applicant/quick-upload" className="ml-1 font-semibold text-orange-700 hover:underline">Upload Documents</a> page:
              </p>
              <ul className="mt-2 grid gap-1 text-sm text-slate-700">
                <li className="flex gap-2"><span className="text-orange-700">•</span><span>A voided personal check</span></li>
                <li className="flex gap-2"><span className="text-orange-700">•</span><span>A direct deposit authorization slip from your financial institution</span></li>
                <li className="flex gap-2"><span className="text-orange-700">•</span><span>A printout of your account information from your bank's online banking</span></li>
              </ul>
              <label className="mt-3 inline-flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={form.attestProofUploaded} onChange={(e) => update("attestProofUploaded", e.target.checked)} />
                <span>I have uploaded proof of account on the Upload Documents page.</span>
              </label>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader><CardTitle>ACH Authorization</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            {DIRECT_DEPOSIT_AUTHORIZATION}
          </div>
          <label className="mt-3 inline-flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={form.authorized} onChange={(e) => update("authorized", e.target.checked)} />
            <span>I authorize Quality One Care to process direct deposit transactions per the terms above.</span>
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

function AccountCard({ label, account, onChange, allowRemainder }: { label: string; account: DirectDepositAccount; onChange: (patch: Partial<DirectDepositAccount>) => void; allowRemainder: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account Type" required>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <RadioOption name={`${label}-type`} label="Checking" checked={account.accountType === "checking"} onSelect={() => onChange({ accountType: "checking" })} />
              <RadioOption name={`${label}-type`} label="Savings" checked={account.accountType === "savings"} onSelect={() => onChange({ accountType: "savings" })} />
            </div>
          </Field>
          <Field label="Financial Institution Name" required><Input value={account.financialInstitutionName} onChange={(e) => onChange({ financialInstitutionName: e.target.value })} /></Field>
          <Field label="Routing Number (9 digits)" required>
            <Input inputMode="numeric" maxLength={9} value={account.routingNumber} onChange={(e) => onChange({ routingNumber: e.target.value.replace(/\D/g, "").slice(0, 9) })} placeholder="123456789" />
          </Field>
          <Field label="Account Number" required>
            <Input inputMode="numeric" value={account.accountNumber} onChange={(e) => onChange({ accountNumber: e.target.value.replace(/\D/g, "") })} />
          </Field>
          <Field label="Deposit Amount" required className="sm:col-span-2">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {!allowRemainder && (
                <RadioOption name={`${label}-amt`} label="Net pay (entire check)" checked={account.amountKind === "net"} onSelect={() => onChange({ amountKind: "net", amountSpecified: "" })} />
              )}
              {allowRemainder && (
                <RadioOption name={`${label}-amt`} label="Remainder of net pay" checked={account.amountKind === "remainder"} onSelect={() => onChange({ amountKind: "remainder", amountSpecified: "" })} />
              )}
              <RadioOption name={`${label}-amt`} label="Fixed $ amount" checked={account.amountKind === "fixed_amount"} onSelect={() => onChange({ amountKind: "fixed_amount" })} />
              <RadioOption name={`${label}-amt`} label="Percentage %" checked={account.amountKind === "percentage"} onSelect={() => onChange({ amountKind: "percentage" })} />
            </div>
          </Field>
          {(account.amountKind === "fixed_amount" || account.amountKind === "percentage") && (
            <Field label={account.amountKind === "fixed_amount" ? "Specify amount ($)" : "Specify percentage (%)"} required>
              <Input value={account.amountSpecified} onChange={(e) => onChange({ amountSpecified: e.target.value })} />
            </Field>
          )}
          <Field label="Account nickname (optional)"><Input value={account.accountNickname} onChange={(e) => onChange({ accountNickname: e.target.value })} placeholder="e.g. Joint checking" /></Field>
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

function RadioOption({ name, label, checked, onSelect }: { name: string; label: string; checked: boolean; onSelect: () => void }) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <input type="radio" name={name} checked={checked} onChange={onSelect} /> {label}
    </label>
  );
}
