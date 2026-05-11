"use client";

import type { ExternalVerificationType, VerificationCategory, VerificationItemStatus } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const statuses: Array<[VerificationItemStatus, string]> = [
  ["pending", "Pending"],
  ["pending_external_check", "Pending External Check"],
  ["verified", "Verified"],
  ["failed", "Failed"],
  ["expired", "Expired"],
  ["needs_followup", "Needs Follow-up"],
  ["not_applicable", "Not Applicable"]
];

const nonExpirableCategories = new Set<VerificationCategory>([
  "professional_employment_verification",
  "character_reference",
  "oig_exclusion",
  "maryland_case_search",
  "employment_history",
  "final_decision"
]);

const typeByCategory: Partial<Record<VerificationCategory, ExternalVerificationType>> = {
  maryland_board_of_nursing: "maryland_board_of_nursing",
  nursys: "nursys",
  maryland_case_search: "maryland_case_search",
  oig_exclusion: "oig",
  background_check_cgis: "cgis",
  liability_insurance_nso: "nso",
  cpr: "cpr"
};

export function VerificationItemForm({
  itemId,
  category,
  currentStatus,
  documents
}: {
  itemId: string;
  category: VerificationCategory;
  currentStatus: VerificationItemStatus;
  documents: Array<{ id: string; fileName: string; documentType: string }>;
}) {
  const [status, setStatus] = useState<VerificationItemStatus>(currentStatus);
  const [result, setResult] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [externalReferenceNumber, setExternalReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/hr/verification/items/${itemId}/update`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        status,
        result,
        expirationDate,
        externalReferenceNumber,
        notes,
        documentId: documentId || undefined,
        verificationType: typeByCategory[category] ?? "other",
        providerName: typeByCategory[category] ?? undefined,
        trackingNumber: externalReferenceNumber,
        externalResult: result,
        externalNotes: notes
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Verification item could not be updated.");
      setBusy(false);
      return;
    }
    // Show explicit confirmation so HR sees their change took effect, then refresh.
    setMessage("✓ Saved. Refreshing the checklist…");
    setBusy(false);
    setTimeout(() => window.location.reload(), 700);
  }

  const canExpire = !nonExpirableCategories.has(category);
  const availableStatuses = canExpire ? statuses : statuses.filter(([v]) => v !== "expired");

  return (
    <form onSubmit={submit} className="grid gap-2">
      <select value={status} onChange={(event) => setStatus(event.target.value as VerificationItemStatus)} className="h-10 rounded-md border bg-white px-3 text-sm">
        {availableStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <input value={result} onChange={(event) => setResult(event.target.value)} placeholder="Verification result" className="h-10 rounded-md border bg-white px-3 text-sm" />
      {canExpire && (
        <input value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} type="date" className="h-10 rounded-md border bg-white px-3 text-sm" />
      )}
      <input value={externalReferenceNumber} onChange={(event) => setExternalReferenceNumber(event.target.value)} placeholder="Reference or tracking number" className="h-10 rounded-md border bg-white px-3 text-sm" />
      <select value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
        <option value="">No evidence document</option>
        {documents.map((document) => <option key={document.id} value={document.id}>{document.fileName} ({document.documentType})</option>)}
      </select>
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes required for not applicable or warning items" rows={3} className="rounded-md border bg-white px-3 py-2 text-sm" />
      <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Update"}</Button>
      {message && <p className={`text-sm ${message.startsWith("✓") ? "text-emerald-700 font-semibold" : "text-orange-700"}`}>{message}</p>}
    </form>
  );
}
