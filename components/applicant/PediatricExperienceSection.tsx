"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";

const fieldClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function parseStored(stored: string) {
  const lines = stored.split(/\r?\n/);
  const fromLine = (label: string) => {
    const line = lines.find((ln) => ln.toLowerCase().startsWith(label.toLowerCase()));
    return line ? line.slice(line.indexOf(":") + 1).trim() : "";
  };
  const has = fromLine("Has pediatric experience").toLowerCase();
  return {
    hasPediatric: has === "yes" ? "yes" : has === "no" ? "no" : "",
    years: fromLine("Years"),
    duties: fromLine("Duties") || (stored && !lines.some((ln) => ln.includes(":")) ? stored.trim() : "")
  };
}

function compose(form: { hasPediatric: string; years: string; duties: string }) {
  const parts: string[] = [];
  if (form.hasPediatric) parts.push(`Has pediatric experience: ${form.hasPediatric}`);
  if (form.years) parts.push(`Years: ${form.years}`);
  if (form.duties.trim()) parts.push(`Duties: ${form.duties.trim()}`);
  return parts.join("\n");
}

export function PediatricExperienceSection({ index, stored }: { index: number; stored: string }) {
  const router = useRouter();
  const [form, setForm] = useState(parseStored(stored));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      setBusy(true);
      setMessage(null);
      const response = await fetch("/api/applicant/profile", {
        method: "PATCH",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ pediatricExperience: compose(form) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save." });
        return;
      }
      setMessage({ tone: "ok", text: "Saved." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm text-orange-700">{index}</span>
          Pediatric Experience
        </CardTitle>
        <CardDescription>Quality One Care provides pediatric home care. Tell us about your pediatric clinical background.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4">
          <fieldset className="grid gap-2 text-sm">
            <legend className="font-medium">Have you cared for pediatric patients in the past 2 years?</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2"><input type="radio" name="hasPediatric" value="yes" checked={form.hasPediatric === "yes"} onChange={(e) => setForm({ ...form, hasPediatric: e.target.value })} /> Yes</label>
              <label className="flex items-center gap-2"><input type="radio" name="hasPediatric" value="no" checked={form.hasPediatric === "no"} onChange={(e) => setForm({ ...form, hasPediatric: e.target.value })} /> No</label>
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Approximate years of pediatric clinical experience</span>
            <input type="number" min="0" max="50" step="0.5" value={form.years} onChange={(e) => setForm({ ...form, years: e.target.value })} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Pediatric duties (G-tube, trach, vent, seizure mgmt, behavioral support, etc.)</span>
            <textarea value={form.duties} onChange={(e) => setForm({ ...form, duties: e.target.value })} className="rounded-md border bg-white px-3 py-2 text-sm" rows={4} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save Pediatric Experience"}</Button>
            {message && <p className={message.tone === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
