"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCsrfHeaders } from "@/lib/csrf-client";

function categoryFor(fieldKey?: string | null) {
  if (!fieldKey) return "Other Supporting Document";
  if (/resume/i.test(fieldKey)) return "Resume";
  if (/license|expiration|issuing|issueDate/i.test(fieldKey)) return "License";
  if (/reference/i.test(fieldKey)) return "Reference Document";
  if (/id|dateOfBirth|address|name/i.test(fieldKey)) return "ID or Work Authorization";
  if (/pediatric|employment|employer/i.test(fieldKey)) return "Scanned Application Form";
  return "Other Supporting Document";
}

export function ValidationIssueActions({
  issueId,
  fieldKey,
  documents
}: {
  issueId: string;
  fieldKey?: string | null;
  documents: Array<{ id: string; fileName: string; documentType: string }>;
}) {
  const router = useRouter();
  const uploadRef = useRef<HTMLFormElement | null>(null);
  const [note, setNote] = useState("");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function uploadPage() {
    const form = uploadRef.current;
    if (!form) {
      setMessage("Upload form is not ready. Please refresh and try again.");
      return;
    }
    try {
      setBusy(true);
      setMessage("");
      const formData = new FormData(form);
      formData.set("category", categoryFor(fieldKey));
      formData.set("intakeMode", "supporting_documents");
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: getCsrfHeaders(),
        body: formData
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Upload failed. Please try again.");
        return;
      }
      setMessage("Document/page uploaded for HR review.");
      uploadRef.current?.reset();
      router.refresh();
    } catch {
      setMessage("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function claim(action: "applicant_claims_present" | "hr_review_requested") {
    if (!note.trim()) {
      setMessage("Add a note so HR knows where to look.");
      return;
    }
    try {
      setBusy(true);
      setMessage("");
      const response = await fetch(`/api/intake/issue/${issueId}/claim-present`, {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ note, sourceDocumentId: sourceDocumentId || null, action })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "This item could not be sent to HR review.");
        return;
      }
      setMessage("Sent to HR review.");
      router.refresh();
    } catch {
      setMessage("This item could not be sent to HR review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 grid gap-3 rounded-lg border bg-white p-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><a href="#manual-entry">Fill manually</a></Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => claim("hr_review_requested")}>Send to HR review</Button>
      </div>
      <form ref={uploadRef} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input name="file" type="file" capture="environment" accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        <Button type="button" size="sm" disabled={busy} onClick={uploadPage}>Upload page/document</Button>
      </form>
      <div className="grid gap-2">
        <select value={sourceDocumentId} onChange={(event) => setSourceDocumentId(event.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm">
          <option value="">Attach source document if possible</option>
          {documents.map((document) => <option key={document.id} value={document.id}>{document.fileName} ({document.documentType})</option>)}
        </select>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} className="rounded-md border bg-white px-3 py-2 text-sm" rows={2} placeholder="Example: This is on page 2 of my scanned application." />
        <Button type="button" size="sm" disabled={busy} onClick={() => claim("applicant_claims_present")}>Mark as already included in scanned application</Button>
      </div>
      {message ? <p className="text-xs font-medium text-orange-700">{message}</p> : null}
    </div>
  );
}
