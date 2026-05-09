"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntakeStepStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { IdentityMatchBadge } from "@/components/IdentityMatchBadge";
import {
  type ApplicationFormData,
  type EmployerEntry,
  EMPLOYMENT_TYPES,
  NURSING_DUTIES,
  PEDIATRIC_SETTINGS,
  SHIFT_PREFERENCES,
  emptyApplicationFormData,
  mergeApplicationFormData,
  validateApplicationFormForCompletion
} from "@/services/intake/applicationFormSchema";

type Props = {
  applicationId: string;
  initialData: unknown;
  initialStatus: IntakeStepStatus;
  applicantEmail: string;
  applicantName: string;
};

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass = "min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ApplicationFormStep(props: Props) {
  const router = useRouter();
  const initialMerged = mergeApplicationFormData(props.initialData);
  const [form, setForm] = useState<ApplicationFormData>(() => {
    const seeded: ApplicationFormData = { ...initialMerged };
    if (!seeded.fullLegalName) seeded.fullLegalName = props.applicantName;
    if (!seeded.emailAddress) seeded.emailAddress = props.applicantEmail;
    if (!seeded.dateOfApplication) seeded.dateOfApplication = new Date().toISOString().slice(0, 10);
    return seeded;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [completed, setCompleted] = useState(props.initialStatus === "completed");

  function update<K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateEmployer(slot: "employer1" | "employer2" | "employer3", patch: Partial<EmployerEntry>) {
    setForm((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));
  }

  function toggleArrayValue(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function persist(markCompleted: boolean) {
    if (markCompleted) {
      const errors = validateApplicationFormForCompletion(form);
      if (errors.length) {
        setMessage({ tone: "err", text: errors[0] });
        return;
      }
    }
    try {
      setBusy(true);
      setMessage(null);
      const res = await fetch(`/api/applicant/intake/${props.applicationId}/application_form`, {
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
      if (markCompleted) setCompleted(true);
      router.refresh();
    } catch {
      setMessage({ tone: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      {completed && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-900">
            <p className="font-semibold">Application submitted.</p>
            <p>You can still edit and re-submit while your application is in draft.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Position Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Position Applied For" required>
              <Input value={form.positionAppliedFor} onChange={(e) => update("positionAppliedFor", e.target.value)} />
            </Field>
            <Field label="Date of Application">
              <input type="date" className={fieldClass} value={form.dateOfApplication} onChange={(e) => update("dateOfApplication", e.target.value)} />
            </Field>
            <Field label="Source of Referral">
              <Input value={form.sourceOfReferral} onChange={(e) => update("sourceOfReferral", e.target.value)} />
            </Field>
            <Field label="Date Available to Start">
              <input type="date" className={fieldClass} value={form.dateAvailableToStart} onChange={(e) => update("dateAvailableToStart", e.target.value)} />
            </Field>
            <Field label="Employment Type" className="sm:col-span-2">
              <RadioRow name="employmentType" options={EMPLOYMENT_TYPES} value={form.employmentType} onChange={(v) => update("employmentType", v as ApplicationFormData["employmentType"])} />
            </Field>
            <Field label="Shift Preference (check all)" className="sm:col-span-2">
              <CheckboxRow values={SHIFT_PREFERENCES} selected={form.shiftPreferences} onToggle={(v) => update("shiftPreferences", toggleArrayValue(form.shiftPreferences, v))} />
            </Field>
            <Field label="Salary / Hourly Rate Expected">
              <Input value={form.salaryExpected} onChange={(e) => update("salaryExpected", e.target.value)} placeholder="$ / hour or $ / year" />
            </Field>
            <Field label="Are you 18 or older?" required>
              <YesNo value={form.isOver18} onChange={(v) => update("isOver18", v)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Legal Name (Last, First, MI)" required className="sm:col-span-2">
              <Input value={form.fullLegalName} onChange={(e) => update("fullLegalName", e.target.value)} />
            </Field>
            <Field label="Preferred Name">
              <Input value={form.preferredName} onChange={(e) => update("preferredName", e.target.value)} />
            </Field>
            <Field label="Email Address" required>
              <Input type="email" value={form.emailAddress} onChange={(e) => update("emailAddress", e.target.value)} />
            </Field>
            <Field label="Mailing Address (street, city, state, ZIP)" required className="sm:col-span-2">
              <AddressAutocomplete
                value={form.mailingAddress}
                onChange={(v) => update("mailingAddress", v)}
                placeholder="Start typing — we'll suggest the full address"
              />
              <IdentityMatchBadge currentAddress={form.mailingAddress} applicantName={form.fullLegalName || props.applicantName} />
            </Field>
            <Field label="Phone (Mobile)" required>
              <Input value={form.phoneMobile} onChange={(e) => update("phoneMobile", e.target.value)} />
            </Field>
            <Field label="Phone (Alternate)">
              <Input value={form.phoneAlternate} onChange={(e) => update("phoneAlternate", e.target.value)} />
            </Field>
            <Field label="How long at this address?">
              <Input value={form.yearsAtAddress} onChange={(e) => update("yearsAtAddress", e.target.value)} />
            </Field>
            <Field label="Country of Citizenship">
              <Input value={form.countryOfCitizenship} onChange={(e) => update("countryOfCitizenship", e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Employment Eligibility</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Authorized to work in the US?" required>
              <YesNo value={form.authorizedToWorkUS} onChange={(v) => update("authorizedToWorkUS", v)} />
            </Field>
            <Field label="Will you require visa sponsorship?">
              <YesNo value={form.requiresSponsorship} onChange={(v) => update("requiresSponsorship", v)} />
            </Field>
          </div>
          <p className="mt-3 text-xs italic text-slate-500">If hired, you will be required to provide Form I-9 documentation. Quality One Care participates in E-Verify.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Professional Licensure & Credentials</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Maryland Board of Nursing License # (RN/LPN)">
              <Input value={form.mdNursingLicenseNumber} onChange={(e) => update("mdNursingLicenseNumber", e.target.value)} />
            </Field>
            <Field label="Expiration Date">
              <input type="date" className={fieldClass} value={form.mdNursingLicenseExp} onChange={(e) => update("mdNursingLicenseExp", e.target.value)} />
            </Field>
            <Field label="CPR / BLS Provider">
              <Input value={form.cprProvider} onChange={(e) => update("cprProvider", e.target.value)} />
            </Field>
            <Field label="CPR / BLS Expiration">
              <input type="date" className={fieldClass} value={form.cprExp} onChange={(e) => update("cprExp", e.target.value)} />
            </Field>
            <Field label="Other License / Certification">
              <Input value={form.otherLicense} onChange={(e) => update("otherLicense", e.target.value)} />
            </Field>
            <Field label="Other License Expiration">
              <input type="date" className={fieldClass} value={form.otherLicenseExp} onChange={(e) => update("otherLicenseExp", e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Clinical Experience Summary</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-xs italic text-slate-500">
            COMAR 10.09.53.03(C)(1) requires nurses providing pediatric care to have at least 1 year of pediatric clinical experience within the last 2 years. Report in whole years.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Years pediatric experience (total)">
              <Input value={form.pediatricYearsTotal} onChange={(e) => update("pediatricYearsTotal", e.target.value)} />
            </Field>
            <Field label="Pediatric experience in last 2 years">
              <Input value={form.pediatricYearsLast2} onChange={(e) => update("pediatricYearsLast2", e.target.value)} />
            </Field>
            <Field label="Years non-pediatric (adult / geriatric)">
              <Input value={form.nonPediatricYears} onChange={(e) => update("nonPediatricYears", e.target.value)} />
            </Field>
            <Field label="Total years of nursing experience">
              <Input value={form.totalNursingYears} onChange={(e) => update("totalNursingYears", e.target.value)} />
            </Field>
            <Field label="Pediatric setting(s) where you have practiced" className="sm:col-span-2">
              <CheckboxRow values={PEDIATRIC_SETTINGS} selected={form.pediatricSettings} onToggle={(v) => update("pediatricSettings", toggleArrayValue(form.pediatricSettings, v))} />
            </Field>
            {form.pediatricSettings.includes("Other") && (
              <Field label="If Other, specify" className="sm:col-span-2">
                <Input value={form.pediatricSettingsOther} onChange={(e) => update("pediatricSettingsOther", e.target.value)} />
              </Field>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Education</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="High School / GED" className="sm:col-span-2"><Input value={form.highSchoolGed} onChange={(e) => update("highSchoolGed", e.target.value)} /></Field>
            <Field label="Year"><Input value={form.highSchoolYear} onChange={(e) => update("highSchoolYear", e.target.value)} /></Field>
            <Field label="Nursing School / Program" className="sm:col-span-2"><Input value={form.nursingSchool} onChange={(e) => update("nursingSchool", e.target.value)} /></Field>
            <Field label="Year / Degree"><Input value={form.nursingSchoolYearDegree} onChange={(e) => update("nursingSchoolYearDegree", e.target.value)} /></Field>
            <Field label="Additional Education / CE" className="sm:col-span-2"><Input value={form.additionalEducation} onChange={(e) => update("additionalEducation", e.target.value)} /></Field>
            <Field label="Year"><Input value={form.additionalEducationYear} onChange={(e) => update("additionalEducationYear", e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <EmployerCard slot="employer1" label="Employer #1 (Most Recent)" entry={form.employer1} onChange={(p) => updateEmployer("employer1", p)} onToggleDuty={(v) => updateEmployer("employer1", { duties: toggleArrayValue(form.employer1.duties, v) })} />
      <EmployerCard slot="employer2" label="Employer #2" entry={form.employer2} onChange={(p) => updateEmployer("employer2", p)} onToggleDuty={(v) => updateEmployer("employer2", { duties: toggleArrayValue(form.employer2.duties, v) })} />
      <EmployerCard slot="employer3" label="Employer #3" entry={form.employer3} onChange={(p) => updateEmployer("employer3", p)} onToggleDuty={(v) => updateEmployer("employer3", { duties: toggleArrayValue(form.employer3.duties, v) })} />

      <Card>
        <CardHeader><CardTitle>Background — Criminal History</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-xs italic text-slate-500">A criminal history is not an automatic bar to employment. Conviction records are evaluated based on nature, time elapsed, and relevance.</p>
          <div className="grid gap-4">
            <Field label="Have you ever been convicted of, pleaded guilty to, or pleaded no contest to a crime (other than a minor traffic violation)?" required>
              <YesNo value={form.hasConviction} onChange={(v) => update("hasConviction", v)} />
            </Field>
            {form.hasConviction === "yes" && (
              <Field label="If yes, please explain (date, nature, jurisdiction, disposition)" required>
                <DictatableTextarea className={textareaClass} value={form.convictionExplanation} onChange={(e) => update("convictionExplanation", e.target.value)} />
              </Field>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Voluntary Disclosure of Disability / Accommodation</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-xs italic text-slate-500">Disclosure is voluntary and will not affect employment decisions.</p>
          <div className="grid gap-4">
            <Field label="Do you require a reasonable accommodation for the application or interview process?">
              <YesNo value={form.needsAccommodation} onChange={(v) => update("needsAccommodation", v)} />
            </Field>
            {form.needsAccommodation === "yes" && (
              <Field label="If yes, briefly describe the accommodation requested">
                <DictatableTextarea className={textareaClass} value={form.accommodationDescription} onChange={(e) => update("accommodationDescription", e.target.value)} />
              </Field>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Applicant Certification & Authorization</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs leading-relaxed text-slate-700">
            <p>I certify that the information provided in this application and any accompanying documents is true and complete to the best of my knowledge. I understand that any false statement, omission, or misrepresentation is grounds for refusal to hire, or, if hired, immediate termination of employment regardless of when discovered.</p>
            <p>I authorize Quality One Care Home Health, Inc. and its agents to investigate and verify all information provided, including contacting prior employers, references, educational institutions, and licensing boards. I release Quality One Care, my prior employers, and any person providing information from any liability arising from the disclosure of this information.</p>
            <p>I understand that a conditional offer of employment may be subject to a satisfactory background check, drug screening, fitness-for-duty examination, and verification of employment eligibility, all conducted in accordance with federal, state, and local law, including the Fair Credit Reporting Act (FCRA).</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Type your full legal name to sign" required>
              <Input value={form.signatureName} onChange={(e) => update("signatureName", e.target.value)} placeholder="Full legal name" />
            </Field>
            <Field label="Date" required>
              <input type="date" className={fieldClass} value={form.signatureDate} onChange={(e) => update("signatureDate", e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => persist(false)} variant="outline" disabled={busy}>{busy ? "Saving..." : "Save draft"}</Button>
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

function YesNo({ value, onChange }: { value: "yes" | "no" | ""; onChange: (v: "yes" | "no" | "") => void }) {
  return (
    <div className="flex items-center gap-4">
      <label className="inline-flex items-center gap-1.5 text-sm">
        <input type="radio" checked={value === "yes"} onChange={() => onChange("yes")} /> Yes
      </label>
      <label className="inline-flex items-center gap-1.5 text-sm">
        <input type="radio" checked={value === "no"} onChange={() => onChange("no")} /> No
      </label>
    </div>
  );
}

function RadioRow({ name, options, value, onChange }: { name: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {options.map((opt) => (
        <label key={opt} className="inline-flex items-center gap-1.5 text-sm">
          <input type="radio" name={name} checked={value === opt} onChange={() => onChange(opt)} /> {opt}
        </label>
      ))}
    </div>
  );
}

function CheckboxRow({ values, selected, onToggle }: { values: readonly string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {values.map((v) => (
        <label key={v} className="inline-flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={selected.includes(v)} onChange={() => onToggle(v)} /> {v}
        </label>
      ))}
    </div>
  );
}

function EmployerCard({ label, entry, onChange, onToggleDuty }: { slot: string; label: string; entry: EmployerEntry; onChange: (patch: Partial<EmployerEntry>) => void; onToggleDuty: (v: string) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employer Name"><Input value={entry.employerName} onChange={(e) => onChange({ employerName: e.target.value })} /></Field>
          <Field label="Phone"><Input value={entry.employerPhone} onChange={(e) => onChange({ employerPhone: e.target.value })} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={entry.employerAddress} onChange={(e) => onChange({ employerAddress: e.target.value })} /></Field>
          <Field label="Position / Job Title"><Input value={entry.positionTitle} onChange={(e) => onChange({ positionTitle: e.target.value })} /></Field>
          <Field label="Dates Employed (From / To)"><Input value={entry.datesEmployed} onChange={(e) => onChange({ datesEmployed: e.target.value })} placeholder="06/2022 — 04/2026" /></Field>
          <Field label="Final Pay Rate"><Input value={entry.finalPayRate} onChange={(e) => onChange({ finalPayRate: e.target.value })} /></Field>
          <Field label="Reason for Leaving"><Input value={entry.reasonForLeaving} onChange={(e) => onChange({ reasonForLeaving: e.target.value })} /></Field>
          <Field label="Supervisor Name"><Input value={entry.supervisorName} onChange={(e) => onChange({ supervisorName: e.target.value })} /></Field>
          <Field label="Supervisor Title"><Input value={entry.supervisorTitle} onChange={(e) => onChange({ supervisorTitle: e.target.value })} /></Field>
          <Field label="Supervisor Phone"><Input value={entry.supervisorPhone} onChange={(e) => onChange({ supervisorPhone: e.target.value })} /></Field>
          <Field label="Supervisor Email"><Input type="email" value={entry.supervisorEmail} onChange={(e) => onChange({ supervisorEmail: e.target.value })} /></Field>
          <Field label="May we contact this supervisor?" className="sm:col-span-2">
            <YesNo value={entry.mayContactSupervisor} onChange={(v) => onChange({ mayContactSupervisor: v })} />
          </Field>
          <Field label="Job duties performed (check all)" className="sm:col-span-2">
            <CheckboxRow values={NURSING_DUTIES} selected={entry.duties} onToggle={onToggleDuty} />
          </Field>
          <Field label="Other duties (specify)" className="sm:col-span-2"><Input value={entry.otherDuties} onChange={(e) => onChange({ otherDuties: e.target.value })} /></Field>
          <Field label="Pediatric experience here (years)"><Input value={entry.pediatricYears} onChange={(e) => onChange({ pediatricYears: e.target.value })} /></Field>
          <Field label="Non-pediatric experience here (years)"><Input value={entry.nonPediatricYears} onChange={(e) => onChange({ nonPediatricYears: e.target.value })} /></Field>
        </div>
      </CardContent>
    </Card>
  );
}
