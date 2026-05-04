"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const OUTCOMES = [
  { value: "passed", label: "Passed — recommend hiring", tone: "emerald" },
  { value: "failed", label: "Failed — do not recommend", tone: "red" },
  { value: "no_show", label: "Applicant no-show", tone: "amber" },
  { value: "rescheduled", label: "Reschedule needed", tone: "blue" }
] as const;

export function InterviewOutcomeForm({ applicationId, interviewId }: { applicationId: string; interviewId: string }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<typeof OUTCOMES[number]["value"]>("passed");
  const [hrNote, setHrNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/hr/applications/${applicationId}/interview/${interviewId}/outcome`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ outcome, hrNote })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not record outcome." });
        return;
      }
      setMessage({ tone: "ok", text: "Outcome recorded. Applicant notified, follow-up task created." });
      setHrNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Record interview outcome</p>
        <p className="text-xs text-slate-600">Records outcome, notifies the applicant, and creates an HR follow-up task.</p>
      </div>
      <div className="grid gap-2">
        {OUTCOMES.map((opt) => (
          <label key={opt.value} className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="outcome"
              value={opt.value}
              checked={outcome === opt.value}
              onChange={() => setOutcome(opt.value)}
              className="mt-1"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">HR note (required)</span>
        <textarea
          value={hrNote}
          onChange={(e) => setHrNote(e.target.value)}
          rows={3}
          required
          placeholder="Brief summary of the interview, behavior, key answers, follow-up items…"
          className="rounded-md border bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !hrNote.trim()}>{busy ? "Saving…" : "Record outcome"}</Button>
        {message && <p className={message.tone === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>}
      </div>
    </form>
  );
}
