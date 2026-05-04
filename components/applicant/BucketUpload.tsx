"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, Loader2, X } from "lucide-react";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Doc = {
  id: string;
  fileName: string;
  processingStatus: string;
};

export function BucketUpload({
  bucket,
  title,
  description,
  required,
  documents
}: {
  bucket: string;
  title: string;
  description: string;
  required?: boolean;
  documents: Doc[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("category", bucket);
        form.append("intakeMode", "supporting_documents");
        const response = await fetch("/api/documents/upload", {
          method: "POST",
          headers: getCsrfHeaders(),
          body: form
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setError(payload.error ?? "Upload failed.");
          return;
        }
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const hasDocs = documents.length > 0;

  return (
    <div className={`rounded-lg border ${hasDocs ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-white"} p-4`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {hasDocs ? (
            <CheckCircle2 size={18} className="text-emerald-600" />
          ) : (
            <div className="h-[18px] w-[18px] rounded-full border-2 border-slate-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900">{title}</p>
            {required && !hasDocs && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">REQUIRED</span>}
            {hasDocs && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">{documents.length} uploaded</span>}
          </div>
          <p className="mt-0.5 text-xs text-slate-600">{description}</p>

          {hasDocs && (
            <div className="mt-2 grid gap-1 text-xs">
              {documents.map((d) => (
                <div key={d.id} className="rounded bg-white border border-slate-100 px-2 py-1 flex items-center justify-between">
                  <span className="font-medium text-slate-800 truncate">{d.fileName}</span>
                  <span className="text-slate-500 text-[10px] uppercase">{d.processingStatus}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
            >
              {busy ? <><Loader2 size={12} className="animate-spin" /> Uploading…</> : <><Upload size={12} /> {hasDocs ? "Add more" : "Upload"}</>}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <span className="text-[10px] text-slate-500">PDF, PNG, JPG, or DOCX · 10MB max each</span>
          </div>
          {error && (
            <div className="mt-2 flex items-center gap-1 rounded bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-800">
              <X size={12} /> {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
