"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Reference = {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  employer: string | null;
};

export function ReferencesSection({ index, references }: { index: number; references: Reference[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", relationship: "", phone: "", email: "", employer: "" });
  const [busy, setBusy] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/applicant/references", {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(draft)
      });
      if (!response.ok) return;
      setDraft({ name: "", relationship: "", phone: "", email: "", employer: "" });
      setAdding(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this reference?")) return;
    const response = await fetch(`/api/applicant/references/${id}`, { method: "DELETE", headers: getCsrfHeaders() });
    if (response.ok) router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm text-orange-700">{index}</span>
          References
        </CardTitle>
        <CardDescription>At least one professional or character reference (supervisor preferred).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {references.length === 0 && !adding && (
          <p className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">No references yet. Add at least one.</p>
        )}

        {references.map((ref) => (
          <div key={ref.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-white p-4 text-sm">
            <div>
              <p className="font-semibold text-slate-950">{ref.name}{ref.relationship ? ` · ${ref.relationship}` : ""}</p>
              <p className="text-muted-foreground">
                {[ref.employer, ref.phone, ref.email].filter(Boolean).join(" · ") || "No contact details"}
              </p>
            </div>
            <button type="button" onClick={() => remove(ref.id)} className="rounded-md p-2 text-red-600 hover:bg-red-50" aria-label="Remove reference"><Trash2 size={16} /></button>
          </div>
        ))}

        {adding ? (
          <form onSubmit={add} className="grid gap-3 rounded-md border bg-slate-50 p-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Name *</span>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Relationship</span>
              <Input value={draft.relationship} onChange={(e) => setDraft({ ...draft, relationship: e.target.value })} placeholder="Charge Nurse / Manager" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Phone</span>
              <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Email</span>
              <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-medium">Employer</span>
              <Input value={draft.employer} onChange={(e) => setDraft({ ...draft, employer: e.target.value })} />
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Add Reference"}</Button>
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>+ Add Reference</Button>
        )}
      </CardContent>
    </Card>
  );
}
