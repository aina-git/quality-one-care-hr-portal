"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const OUTCOMES = [
  { value: "pass", label: "PASS", description: "All checks clean — proceed to verification / DON queue", color: "emerald", Icon: CheckCircle2 },
  { value: "amber", label: "NEEDS FINAL APPROVAL", description: "Send to DON for second look", color: "amber", Icon: AlertTriangle },
  { value: "fail", label: "FAIL", description: "Disqualifying issues at HR level", color: "red", Icon: XCircle }
] as const;

const TONE: Record<string, { btn: string; ring: string }> = {
  emerald: { btn: "bg-emerald-600 hover:bg-emerald-700 text-white", ring: "ring-emerald-300" },
  amber:   { btn: "bg-amber-600 hover:bg-amber-700 text-white",     ring: "ring-amber-300" },
  red:     { btn: "bg-red-600 hover:bg-red-700 text-white",         ring: "ring-red-300" }
};

export function HrOutcomeButtons({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<typeof OUTCOMES[number]["value"] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function submit() {
    if (!selected || !note.trim()) {
      setMessage({ tone: "err", text: "Pick an outcome and write a note." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/hr/applications/${applicationId}/outcome`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ outcome: selected, note })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not record outcome." });
        return;
      }
      setMessage({ tone: "ok", text: "Outcome recorded." });
      setNote("");
      setSelected(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm font-semibold text-slate-900">Record HR outcome</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {OUTCOMES.map((opt) => {
          const tone = TONE[opt.color];
          const isSel = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                isSel
                  ? `${tone.btn} border-transparent ring-4 ${tone.ring}`
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <div className="flex items-center gap-2">
                <opt.Icon size={18} />
                <span className="font-bold tracking-wide">{opt.label}</span>
              </div>
              <p className={`mt-1 text-xs ${isSel ? "opacity-90" : "text-slate-600"}`}>{opt.description}</p>
            </button>
          );
        })}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Required HR note explaining your decision…"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        required
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={submit} disabled={busy || !selected || !note.trim()}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save outcome"}
        </Button>
        {message && (
          <p className={message.tone === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>
        )}
      </div>
    </div>
  );
}
