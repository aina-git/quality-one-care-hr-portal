"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type Field = {
  fieldKey: string;
  fieldLabel: string;
  mappedSection: string;
  extractedValue: string;
  confidence: number;
  status: string;
  applicantConfirmed: boolean;
};

type Payload = {
  fileName: string;
  processingStatus: string;
  detectedDocumentType: string | null;
  extractionConfidence: number | null;
  rawText: string | null;
  extractionConfidenceFromExtraction: number | null;
  provider: string | null;
  fields: Field[];
};

// Inline panel that fetches and displays the raw OCR text for a single
// document plus the extracted-field rundown. Lets HR see what the system
// actually captured so it's clear whether the OCR failed or whether the
// data is there but wasn't matched by the regex.
export function HrOcrViewer({ applicationId, documentId }: { applicationId: string; documentId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (data) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/documents/${documentId}`);
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Could not load OCR text.");
        return;
      }
      setData(payload);
      setOpen(true);
    } catch (err) {
      setError("Could not load OCR text.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => (open ? setOpen(false) : load())}
        disabled={loading}
      >
        {open ? <><EyeOff size={12} /> Hide OCR text</> : <><Eye size={12} /> {loading ? "Loading…" : "Show OCR text"}</>}
      </Button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}

      {open && data && (
        <div className="mt-2 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="grid gap-1 sm:grid-cols-2 text-slate-700">
            <p><span className="font-semibold">Detected:</span> {data.detectedDocumentType ?? "—"}</p>
            <p><span className="font-semibold">OCR provider:</span> {data.provider ?? "—"}</p>
            <p>
              <span className="font-semibold">Doc confidence:</span>{" "}
              {data.extractionConfidence != null ? `${(data.extractionConfidence * 100).toFixed(0)}%` : "—"}
            </p>
            <p>
              <span className="font-semibold">OCR confidence:</span>{" "}
              {data.extractionConfidenceFromExtraction != null
                ? `${(data.extractionConfidenceFromExtraction * 100).toFixed(0)}%`
                : "—"}
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-700 mb-1">
              Fields the system pulled from this document ({data.fields.length})
            </p>
            {data.fields.length === 0 ? (
              <p className="text-slate-500 italic">
                Nothing matched. Either the OCR text below is empty/garbled or the field-extraction patterns didn&apos;t
                find anything in it. If the data is clearly visible in the OCR text, the patterns need tightening.
              </p>
            ) : (
              <table className="w-full text-left">
                <thead className="text-slate-500">
                  <tr>
                    <th className="font-medium pr-2 py-0.5">Section</th>
                    <th className="font-medium pr-2 py-0.5">Field</th>
                    <th className="font-medium pr-2 py-0.5">Value</th>
                    <th className="font-medium pr-2 py-0.5">Conf.</th>
                    <th className="font-medium py-0.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fields.map((f, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="pr-2 py-0.5 text-slate-600">{f.mappedSection}</td>
                      <td className="pr-2 py-0.5 text-slate-800">{f.fieldLabel}</td>
                      <td className="pr-2 py-0.5 font-mono text-slate-900 max-w-[260px] truncate" title={f.extractedValue}>
                        {f.extractedValue || <span className="italic text-slate-400">empty</span>}
                      </td>
                      <td className="pr-2 py-0.5">{(f.confidence * 100).toFixed(0)}%</td>
                      <td className="py-0.5">
                        <span
                          className={
                            f.status === "accepted"
                              ? "text-emerald-700"
                              : f.status === "pending_review"
                                ? "text-amber-700"
                                : "text-slate-600"
                          }
                        >
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <p className="font-semibold text-slate-700 mb-1">Raw OCR text</p>
            {data.rawText ? (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-800">
                {data.rawText}
              </pre>
            ) : (
              <p className="text-slate-500 italic">
                No OCR text on file. The processor may have failed, or the document may not have been processed yet.
                Try the &quot;Re-run OCR + auto-fill&quot; button below.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
