"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const BUCKETS = [
  "Application Form",
  "Licenses & Background",
  "IDs / SSN / Passport",
  "Resume & Cover Letter",
  "Combined Package",
  "Reference Document",
  "Other Supporting Document"
];

// HR uploads a document on behalf of the applicant. Hits the existing
// /api/admin/applications/[id]/upload endpoint, which records the actor and
// runs OCR + auto-map just like an applicant upload. Useful when an applicant
// emails / faxes / brings in paper documents during HR review.
export function HrUploadDocument({ applicationId }: { applicationId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [bucket, setBucket] = useState(BUCKETS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      let uploaded = 0;
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("category", bucket);
        const res = await fetch(`/api/admin/applications/${applicationId}/upload`, {
          method: "POST",
          headers: getCsrfHeaders(),
          body: form
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          setError(payload.error ?? "Upload failed.");
          return;
        }
        uploaded += 1;
      }
      setSuccess(`Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"}. Reloading…`);
      setTimeout(() => window.location.reload(), 900);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-white p-3 grid gap-2">
      <p className="text-xs font-medium text-slate-700">Upload on behalf of applicant</p>
      <p className="text-xs text-slate-500">
        For documents the applicant sends in by email, fax, or paper. Pick a bucket, choose files, and the system runs
        OCR + auto-fill the same as a self-upload.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="grid gap-0.5 text-xs">
          <span className="font-medium text-slate-700">Bucket</span>
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            disabled={busy}
            className="h-9 rounded-md border bg-white px-2 text-sm"
          >
            {BUCKETS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <><Loader2 size={12} className="animate-spin" /> Uploading…</> : <><Upload size={12} /> Choose files</>}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.docx"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className="text-[10px] text-slate-500">PDF / PNG / JPG / DOCX · 10MB each</span>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {success && <p className="text-xs text-emerald-700">{success}</p>}
    </div>
  );
}
