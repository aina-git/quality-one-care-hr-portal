"use client";

import { useEffect, useState } from "react";
import { Plus, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const HASH_BY_RECORD: Record<string, string> = {
  employment: "card-employment",
  licenses: "card-licenses",
  certifications: "card-certifications",
  references: "card-references"
};

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "date" | "checkbox" | "textarea";
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
};

// Generic "Add a row" form used on the HR review page for the four child
// record types (employment, license, certification, reference). Pass the
// API endpoint and the field definitions and the component handles the rest.
export function HrAddRecordForm({
  applicationId,
  recordType,
  fields,
  buttonLabel
}: {
  applicationId: string;
  recordType: "employment" | "licenses" | "certifications" | "references";
  fields: FieldDef[];
  buttonLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of fields) init[f.key] = f.type === "checkbox" ? false : "";
    return init;
  });
  // Auto-open when HR jumps here from the Open Issues fix link.
  useEffect(() => {
    const hash = HASH_BY_RECORD[recordType];
    if (typeof window !== "undefined" && hash && window.location.hash === `#${hash}`) {
      setOpen(true);
    }
  }, [recordType]);

  function setField(key: string, value: string | boolean) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    for (const f of fields) {
      if (f.required && !String(values[f.key] ?? "").trim()) {
        setError(`${f.label} is required.`);
        setBusy(false);
        return;
      }
    }
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/${recordType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify(values)
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Could not save the record.");
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch (err) {
      setError("Could not save the record.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus size={12} /> {buttonLabel}
      </Button>
    );
  }

  return (
    <div className="rounded-md border bg-slate-50 p-3 grid gap-2 mt-2">
      <div className="grid gap-2 md:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className={`grid gap-1 text-sm ${f.type === "textarea" ? "md:col-span-2" : ""}`}>
            <span className="font-medium text-slate-700">
              {f.label}{f.required && <span className="text-red-600"> *</span>}
            </span>
            {f.type === "textarea" ? (
              <textarea
                value={String(values[f.key] ?? "")}
                onChange={(e) => setField(f.key, e.target.value)}
                rows={3}
                maxLength={f.maxLength ?? 4000}
                placeholder={f.placeholder}
                className="rounded-md border bg-white px-3 py-2 text-sm"
              />
            ) : f.type === "checkbox" ? (
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(values[f.key])}
                  onChange={(e) => setField(f.key, e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-xs text-slate-500">{f.placeholder ?? ""}</span>
              </span>
            ) : (
              <input
                type={f.type ?? "text"}
                value={String(values[f.key] ?? "")}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={f.placeholder}
                maxLength={f.maxLength ?? 200}
                className="h-9 rounded-md border bg-white px-3 text-sm"
              />
            )}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
          <X size={12} /> Cancel
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={submit}>
          <Save size={12} /> {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
