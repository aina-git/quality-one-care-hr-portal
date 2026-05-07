"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

type Props = {
  index: number;
  defaultName: string;
  defaultEmail: string;
  defaultPhone: string;
  defaultAddress: string;
  defaultCity: string;
  defaultState: string;
  defaultZip: string;
  defaultDateOfBirth: string;
};

function fieldClass() {
  return "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

export function PersonalInfoSection(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: props.defaultName,
    phone: props.defaultPhone,
    address: props.defaultAddress,
    city: props.defaultCity,
    state: props.defaultState,
    zip: props.defaultZip,
    dateOfBirth: props.defaultDateOfBirth
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      setBusy(true);
      setMessage(null);
      const response = await fetch("/api/applicant/profile", {
        method: "PATCH",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(form)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save personal information." });
        return;
      }
      setMessage({ tone: "ok", text: "Saved." });
      router.refresh();
    } catch {
      setMessage({ tone: "err", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm text-orange-700">{props.index}</span>
          Personal Information
        </CardTitle>
        <CardDescription>Your full legal name, contact details, and date of birth.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium">Full legal name</span>
            <Input value={form.name} onChange={(e) => setField("name", e.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Email (account)</span>
            <Input value={props.defaultEmail} disabled className="bg-slate-50" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Phone</span>
            <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="443-555-0123" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Date of birth</span>
            <input type="date" value={form.dateOfBirth} onChange={(e) => setField("dateOfBirth", e.target.value)} className={fieldClass()} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium">Street address</span>
            <AddressAutocomplete
              value={form.address}
              onChange={(v) => setField("address", v)}
              autoFillCombined={false}
              onSelectSuggestion={(s) => {
                setForm((prev) => ({
                  ...prev,
                  address: s.street || prev.address,
                  city: s.city || prev.city,
                  state: s.state || prev.state,
                  zip: s.zip || prev.zip
                }));
              }}
              placeholder="Start typing your street address…"
            />
            <span className="text-xs text-slate-500">Suggestions auto-fill city, state, and ZIP.</span>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">City</span>
            <Input value={form.city} onChange={(e) => setField("city", e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">State</span>
            <Input value={form.state} onChange={(e) => setField("state", e.target.value)} placeholder="MD" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">ZIP</span>
            <Input value={form.zip} onChange={(e) => setField("zip", e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save Personal Info"}</Button>
            {message && <p className={message.tone === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
