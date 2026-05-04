"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCsrfHeaders } from "@/lib/csrf-client";
import { intakeFieldGroups } from "@/lib/intakeFieldOptions";

export function ManualFieldForm() {
  const router = useRouter();
  const [fieldKey, setFieldKey] = useState("phone");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setBusy(true);
      setMessage("");
      const response = await fetch("/api/intake/manual-field", {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ fieldKey, value })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Please choose a field and enter a value.");
        return;
      }
      setValue("");
      setMessage("Manual entry saved.");
      router.refresh();
    } catch {
      setMessage("Manual entry could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border bg-slate-50 p-4 sm:grid-cols-[220px_1fr_auto]">
      <select value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
        {intakeFieldGroups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.fields.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </optgroup>
        ))}
      </select>
      <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Enter missing information" />
      <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Add Manual Entry"}</Button>
      {message && <p className="text-sm text-orange-700 sm:col-span-3">{message}</p>}
    </form>
  );
}
