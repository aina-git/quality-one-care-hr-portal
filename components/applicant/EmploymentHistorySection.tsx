"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Job = {
  id: string;
  employerName: string;
  roleTitle: string;
  supervisorName: string | null;
  supervisorPhone: string | null;
  duties: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  pediatricCare: boolean;
};

function dateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function EmploymentHistorySection({ index, jobs }: { index: number; jobs: Job[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ employerName: "", roleTitle: "", supervisorName: "", supervisorPhone: "", duties: "", startDate: "", endDate: "", pediatricCare: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    try {
      setBusy(true);
      setMessage(null);
      const response = await fetch("/api/applicant/employment", {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(draft)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save employment record." });
        return;
      }
      setDraft({ employerName: "", roleTitle: "", supervisorName: "", supervisorPhone: "", duties: "", startDate: "", endDate: "", pediatricCare: false });
      setAdding(false);
      setMessage({ tone: "ok", text: "Employment record added." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this employment record?")) return;
    const response = await fetch(`/api/applicant/employment/${id}`, {
      method: "DELETE",
      headers: getCsrfHeaders()
    });
    if (response.ok) router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm text-orange-700">{index}</span>
          Employment History
        </CardTitle>
        <CardDescription>List your relevant employment, especially any with pediatric or skilled-nursing experience.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {jobs.length === 0 && !adding && (
          <p className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">
            No employment records yet. Add at least one — your most recent role first.
          </p>
        )}

        {jobs.map((job) => (
          <div key={job.id} className="grid gap-1 rounded-md border bg-white p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-950">{job.employerName} — {job.roleTitle}</p>
                <p className="text-muted-foreground">
                  {dateInput(job.startDate) || "?"} → {dateInput(job.endDate) || "Present"}
                  {job.pediatricCare && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Pediatric</span>}
                </p>
              </div>
              <button type="button" onClick={() => remove(job.id)} className="rounded-md p-2 text-red-600 hover:bg-red-50" aria-label="Remove employment record">
                <Trash2 size={16} />
              </button>
            </div>
            {job.supervisorName && <p className="text-muted-foreground">Supervisor: {job.supervisorName}{job.supervisorPhone ? ` · ${job.supervisorPhone}` : ""}</p>}
            {job.duties && <p className="mt-1 whitespace-pre-wrap text-slate-700">{job.duties}</p>}
          </div>
        ))}

        {adding ? (
          <form onSubmit={add} className="grid gap-3 rounded-md border bg-slate-50 p-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm sm:col-span-1">
              <span className="font-medium">Employer name *</span>
              <Input value={draft.employerName} onChange={(e) => setDraft({ ...draft, employerName: e.target.value })} required />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-1">
              <span className="font-medium">Role / title *</span>
              <Input value={draft.roleTitle} onChange={(e) => setDraft({ ...draft, roleTitle: e.target.value })} required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Start date</span>
              <input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} className={fieldClass} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">End date <span className="text-muted-foreground">(blank if current)</span></span>
              <input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} className={fieldClass} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Supervisor name</span>
              <Input value={draft.supervisorName} onChange={(e) => setDraft({ ...draft, supervisorName: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Supervisor phone</span>
              <Input value={draft.supervisorPhone} onChange={(e) => setDraft({ ...draft, supervisorPhone: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-medium">Duties / responsibilities</span>
              <textarea value={draft.duties} onChange={(e) => setDraft({ ...draft, duties: e.target.value })} className="rounded-md border bg-white px-3 py-2 text-sm" rows={3} />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={draft.pediatricCare} onChange={(e) => setDraft({ ...draft, pediatricCare: e.target.checked })} />
              <span>This role involved pediatric patients</span>
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Add Employment"}</Button>
              <Button type="button" variant="outline" onClick={() => { setAdding(false); setMessage(null); }}>Cancel</Button>
              {message && <p className={message.tone === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>}
            </div>
          </form>
        ) : (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>+ Add Employment Record</Button>
        )}
        {!adding && message && <p className={message.tone === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>}
      </CardContent>
    </Card>
  );
}
