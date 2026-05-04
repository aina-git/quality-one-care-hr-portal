"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function HRNoteForm({ applicationId }: { applicationId: string }) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch(`/api/hr/applications/${applicationId}/notes`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ note })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Note could not be saved.");
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        required
        rows={3}
        placeholder="Internal HR note. Not visible to applicant."
        className="rounded-md border bg-white px-3 py-2 text-sm"
      />
      <Button type="submit" variant="outline">Add Internal Note</Button>
      {message && <p className="text-sm text-orange-700">{message}</p>}
    </form>
  );
}
