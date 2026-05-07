"use client";

import { useEffect, useState } from "react";
import { Pencil, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Initial = {
  phone: string | null;
  dateOfBirth: string | null; // ISO date (yyyy-mm-dd) or null
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

function formatDateForInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function dataRow(label: string, value: string | null | undefined) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5 text-sm border-b border-slate-100 last:border-0">
      <span className="font-medium text-slate-600">{label}</span>
      <span className="text-slate-900">
        {value && value.trim() ? value : <span className="text-slate-400 italic">Not provided</span>}
      </span>
    </div>
  );
}

export function HrContactEditor({
  applicationId,
  email,
  initial
}: {
  applicationId: string;
  email: string;
  initial: Initial;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Auto-open into edit mode when HR jumps here from the Open Issues fix link.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#card-contact") {
      setEditing(true);
    }
  }, []);
  const [data, setData] = useState({
    phone: initial.phone ?? "",
    dateOfBirth: formatDateForInput(initial.dateOfBirth),
    address: initial.address ?? "",
    city: initial.city ?? "",
    state: initial.state ?? "",
    zip: initial.zip ?? ""
  });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/applicant-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({
          phone: data.phone,
          dateOfBirth: data.dateOfBirth || null,
          address: data.address,
          city: data.city,
          state: data.state,
          zip: data.zip
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Could not save changes.");
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch (err) {
      setError("Could not save changes.");
      setBusy(false);
    }
  }

  if (!editing) {
    const fullAddress = [data.address, data.city, data.state, data.zip].filter(Boolean).join(", ");
    return (
      <>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-500">Click Edit to fill in any missing fields manually.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={12} /> Edit
          </Button>
        </div>
        {dataRow("Email", email)}
        {dataRow("Phone", data.phone || null)}
        {dataRow("Date of birth", initial.dateOfBirth ? new Date(initial.dateOfBirth).toLocaleDateString("en-US") : null)}
        {dataRow("Address", fullAddress || null)}
      </>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Phone</span>
          <input
            value={data.phone}
            onChange={(e) => setData({ ...data, phone: e.target.value })}
            className="h-9 rounded-md border bg-white px-3 text-sm"
            placeholder="(555) 555-5555"
            maxLength={50}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Date of birth</span>
          <input
            type="date"
            value={data.dateOfBirth}
            onChange={(e) => setData({ ...data, dateOfBirth: e.target.value })}
            className="h-9 rounded-md border bg-white px-3 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Street address</span>
          <input
            value={data.address}
            onChange={(e) => setData({ ...data, address: e.target.value })}
            className="h-9 rounded-md border bg-white px-3 text-sm"
            maxLength={240}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">City</span>
          <input
            value={data.city}
            onChange={(e) => setData({ ...data, city: e.target.value })}
            className="h-9 rounded-md border bg-white px-3 text-sm"
            maxLength={120}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">State</span>
          <input
            value={data.state}
            onChange={(e) => setData({ ...data, state: e.target.value })}
            className="h-9 rounded-md border bg-white px-3 text-sm"
            maxLength={60}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">ZIP</span>
          <input
            value={data.zip}
            onChange={(e) => setData({ ...data, zip: e.target.value })}
            className="h-9 rounded-md border bg-white px-3 text-sm"
            maxLength={30}
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(false)}>
          <X size={12} /> Cancel
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={save}>
          <Save size={12} /> {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
