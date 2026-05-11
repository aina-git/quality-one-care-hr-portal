"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Props = {
  itemId: string;
  applicationId: string;
  applicantName: string;
  desiredRole: string | null;
  hrUserName: string;
  hrUserEmail: string;
};

const POSITION_OPTIONS = ["RN", "LPN", "CNA", "CNA-CMT"] as const;

function detectPosition(desiredRole: string | null): string {
  if (!desiredRole) return "";
  const upper = desiredRole.toUpperCase();
  if (upper.includes("CNA-CMT") || upper.includes("CMT")) return "CNA-CMT";
  if (upper.includes("CNA")) return "CNA";
  if (upper.includes("LPN")) return "LPN";
  if (upper.includes("RN") || upper.includes("REGISTERED")) return "RN";
  return "";
}

export function CgisPrefilledForm({ itemId, applicationId, applicantName, desiredRole, hrUserName, hrUserEmail }: Props) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [position, setPosition] = useState(detectPosition(desiredRole));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submitCgis() {
    if (!trackingNumber.trim()) {
      setMessage("Tracking number is required.");
      return;
    }
    if (!position) {
      setMessage("Select the position applying for.");
      return;
    }
    setBusy(true);
    setMessage("");

    const result = [
      `Agency: Quality One Care Home Health Inc.`,
      `Provider Number: 420641000`,
      `Staff/Applicant Name: ${applicantName}`,
      `Tracking Number: ${trackingNumber.trim()}`,
      `Position Applying For: ${position}`,
      `Completed by: ${hrUserName}`,
      `Email: ${hrUserEmail}`
    ].join(" | ");

    const res = await fetch(`/api/hr/verification/items/${itemId}/update`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        status: "pending_external_check",
        result,
        externalReferenceNumber: trackingNumber.trim(),
        notes: notes.trim() || `CGIS/CJIS submitted. Tracking: ${trackingNumber.trim()}. Awaiting clearance.`,
        verificationType: "cgis",
        providerName: "cgis",
        trackingNumber: trackingNumber.trim(),
        externalResult: "Pending",
        externalNotes: `Submitted by ${hrUserName} (${hrUserEmail})`
      })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(payload.error ?? "Could not submit.");
      setBusy(false);
      return;
    }
    setMessage("Submitted. Marked as Pending External Check.");
    setBusy(false);
    setTimeout(() => window.location.reload(), 800);
  }

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-4">
      <p className="text-sm font-semibold text-orange-900 mb-3">CGIS / CJIS Background Check Submission</p>

      <div className="grid gap-3 text-sm">
        <div className="grid grid-cols-[160px_1fr] items-center gap-2">
          <span className="font-medium text-slate-700">Agency Name:</span>
          <span className="font-semibold text-slate-900">Quality One Care Home Health Inc.</span>
        </div>
        <div className="grid grid-cols-[160px_1fr] items-center gap-2">
          <span className="font-medium text-slate-700">Provider Number:</span>
          <span className="font-semibold text-slate-900">420641000</span>
        </div>
        <div className="grid grid-cols-[160px_1fr] items-center gap-2">
          <span className="font-medium text-slate-700">Staff/Applicant Name:</span>
          <span className="font-semibold text-slate-900">{applicantName}</span>
        </div>
        <div className="grid grid-cols-[160px_1fr] items-center gap-2">
          <label className="font-medium text-slate-700">Tracking Number:<span className="text-red-600 ml-0.5">*</span></label>
          <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Enter tracking number" className="bg-white" />
        </div>
        <div className="grid grid-cols-[160px_1fr] items-center gap-2">
          <label className="font-medium text-slate-700">Position Applying For:<span className="text-red-600 ml-0.5">*</span></label>
          <div className="flex flex-wrap gap-3">
            {POSITION_OPTIONS.map((opt) => (
              <label key={opt} className="inline-flex items-center gap-1.5 text-sm">
                <input type="radio" name="cgis-position" checked={position === opt} onChange={() => setPosition(opt)} /> {opt}
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[160px_1fr] items-center gap-2">
          <span className="font-medium text-slate-700">Completed by:</span>
          <span className="text-slate-900">{hrUserName}</span>
        </div>
        <div className="grid grid-cols-[160px_1fr] items-center gap-2">
          <span className="font-medium text-slate-700">Email:</span>
          <span className="text-slate-900">{hrUserEmail}</span>
        </div>
        <div className="grid grid-cols-[160px_1fr] items-start gap-2">
          <label className="font-medium text-slate-700 pt-2">Notes (optional):</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} className="rounded-md border bg-white px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submitCgis} disabled={busy}>{busy ? "Submitting..." : "Submit CGIS Check"}</Button>
        {message && <p className={`text-sm ${message.includes("Submitted") ? "text-emerald-700 font-semibold" : "text-red-700"}`}>{message}</p>}
      </div>

      <p className="mt-2 text-xs text-slate-500">After submission, this item will be marked as "Pending External Check" until HR verifies the result.</p>
    </div>
  );
}
