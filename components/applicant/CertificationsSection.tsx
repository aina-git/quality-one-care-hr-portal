"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Certification = {
  id: string;
  name: string;
  issuer: string | null;
  issueDate: Date | string | null;
  expiresAt: Date | string | null;
};

function dateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CertificationsSection({ index, certifications }: { index: number; certifications: Certification[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", issuer: "", issueDate: "", expiresAt: "" });
  const [busy, setBusy] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/applicant/certifications", {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(draft)
      });
      if (!response.ok) return;
      setDraft({ name: "", issuer: "", issueDate: "", expiresAt: "" });
      setAdding(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this certification?")) return;
    const response = await fetch(`/api/applicant/certifications/${id}`, { method: "DELETE", headers: getCsrfHeaders() });
    if (response.ok) router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm text-orange-700">{index}</span>
          Certifications
        </CardTitle>
        <CardDescription>CPR/BLS, training certificates, sanitation, infection control, etc.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {certifications.length === 0 && !adding && (
          <p className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">No certifications yet. CPR is required.</p>
        )}

        {certifications.map((cert) => (
          <div key={cert.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-white p-4 text-sm">
            <div>
              <p className="font-semibold text-slate-950">{cert.name}</p>
              <p className="text-muted-foreground">
                {cert.issuer ?? "—"} · Issued {dateInput(cert.issueDate) || "?"} · Expires {dateInput(cert.expiresAt) || "—"}
              </p>
            </div>
            <button type="button" onClick={() => remove(cert.id)} className="rounded-md p-2 text-red-600 hover:bg-red-50" aria-label="Remove certification"><Trash2 size={16} /></button>
          </div>
        ))}

        {adding ? (
          <form onSubmit={add} className="grid gap-3 rounded-md border bg-slate-50 p-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Name *</span>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="BLS / CPR" required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Issuer</span>
              <Input value={draft.issuer} onChange={(e) => setDraft({ ...draft, issuer: e.target.value })} placeholder="American Heart Association" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Issue date</span>
              <input type="date" value={draft.issueDate} onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })} className={fieldClass} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Expiration date</span>
              <input type="date" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} className={fieldClass} />
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Add Certification"}</Button>
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>+ Add Certification</Button>
        )}
      </CardContent>
    </Card>
  );
}
