"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";

type License = {
  id: string;
  type: string;
  licenseNumber: string | null;
  issuingState: string | null;
  issueDate: Date | string | null;
  expiresAt: Date | string | null;
};

function dateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LicensesSection({ index, licenses }: { index: number; licenses: License[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ type: "", licenseNumber: "", issuingState: "", issueDate: "", expiresAt: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    try {
      setBusy(true);
      setMessage(null);
      const response = await fetch("/api/applicant/licenses", {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(draft)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save license." });
        return;
      }
      setDraft({ type: "", licenseNumber: "", issuingState: "", issueDate: "", expiresAt: "" });
      setAdding(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this license?")) return;
    const response = await fetch(`/api/applicant/licenses/${id}`, { method: "DELETE", headers: getCsrfHeaders() });
    if (response.ok) router.refresh();
  }

  function expirationStatus(value: Date | string | null) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    if (d < new Date()) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Expired</span>;
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
    if (days <= 30) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Expires in {days}d</span>;
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm text-orange-700">{index}</span>
          Licenses
        </CardTitle>
        <CardDescription>RN, LPN, CNA, or other professional licenses. Add each license you currently hold.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {licenses.length === 0 && !adding && (
          <p className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">
            No licenses yet. Required for nursing roles.
          </p>
        )}

        {licenses.map((license) => (
          <div key={license.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-white p-4 text-sm">
            <div>
              <p className="font-semibold text-slate-950">{license.type}{license.licenseNumber ? ` · ${license.licenseNumber}` : ""}</p>
              <p className="text-muted-foreground">
                {license.issuingState ?? "—"} · Issued {dateInput(license.issueDate) || "?"} · Expires {dateInput(license.expiresAt) || "?"}
                {" "}{expirationStatus(license.expiresAt)}
              </p>
            </div>
            <button type="button" onClick={() => remove(license.id)} className="rounded-md p-2 text-red-600 hover:bg-red-50" aria-label="Remove license"><Trash2 size={16} /></button>
          </div>
        ))}

        {adding ? (
          <form onSubmit={add} className="grid gap-3 rounded-md border bg-slate-50 p-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">License type *</span>
              <Input value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} placeholder="RN / LPN / CNA" required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">License number</span>
              <Input value={draft.licenseNumber} onChange={(e) => setDraft({ ...draft, licenseNumber: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Issuing state / authority</span>
              <Input value={draft.issuingState} onChange={(e) => setDraft({ ...draft, issuingState: e.target.value })} placeholder="MD" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Issue date</span>
              <input type="date" value={draft.issueDate} onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })} className={fieldClass} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-medium">Expiration date</span>
              <input type="date" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} className={fieldClass} />
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Add License"}</Button>
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              {message && <p className={message.tone === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>}
            </div>
          </form>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>+ Add License</Button>
        )}
      </CardContent>
    </Card>
  );
}
