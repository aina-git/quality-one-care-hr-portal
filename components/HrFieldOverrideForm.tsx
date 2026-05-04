"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function HrFieldOverrideForm({ fieldId }: { fieldId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!note.trim()) {
      setMessage("HR override requires a note.");
      return;
    }
    try {
      setBusy(true);
      setMessage("");
      const response = await fetch(`/api/hr/extracted-fields/${fieldId}/override`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ note })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Override could not be applied.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Override could not be applied.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="rounded-md border bg-white px-3 py-2 text-sm" placeholder="Required HR override note" />
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={submit}>{busy ? "Applying..." : "Apply HR Override"}</Button>
      {message ? <p className="text-xs font-medium text-red-700">{message}</p> : null}
    </div>
  );
}
