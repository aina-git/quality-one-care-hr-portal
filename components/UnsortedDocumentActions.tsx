"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const documentTypes = [
  "Application Form",
  "Resume",
  "License",
  "CPR",
  "ID",
  "Medical",
  "Training",
  "Background Check",
  "Other"
];

export function UnsortedDocumentActions({
  documentId,
  compact = false
}: {
  documentId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [documentType, setDocumentType] = useState(documentTypes[0]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function update(action: "assign" | "irrelevant" | "clarification") {
    try {
      setBusy(true);
      setMessage("");
      const response = await fetch(`/api/hr/documents/${documentId}/classify`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ action, documentType, note })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Document could not be updated.");
        return;
      }
      setMessage(payload.message ?? "Document updated.");
      router.refresh();
    } catch {
      setMessage("Document could not be updated. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "grid gap-2" : "grid gap-3 rounded-xl border bg-slate-50 p-3"}>
      <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
        {documentTypes.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={compact ? 2 : 3} className="rounded-md border bg-white px-3 py-2 text-sm" placeholder="Optional note or clarification request." />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => update("assign")}>Assign Type</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => update("clarification")}>Request Clarification</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => update("irrelevant")}>Mark Irrelevant</Button>
      </div>
      {message ? <p className="text-xs font-medium text-orange-700">{message}</p> : null}
    </div>
  );
}
