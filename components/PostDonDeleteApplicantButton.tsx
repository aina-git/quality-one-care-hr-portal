"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Props = {
  userId: string;
  applicantName: string;
  decisionLabel: string;
};

export function PostDonDeleteApplicantButton({ userId, applicantName, decisionLabel }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function execute() {
    if (!confirm(`This will permanently delete ${applicantName}'s account and ALL related data (application, documents, verification, decisions). The DON decision (${decisionLabel}) will also be removed. This cannot be undone. Continue?`)) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}?force=true`, {
        method: "DELETE",
        headers: getCsrfHeaders({ "Content-Type": "application/json" })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error ?? "Could not delete applicant.");
        setBusy(false);
        return;
      }
      window.location.href = "/don/approval-queue";
    } catch {
      setMessage("Network error.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-red-300 text-red-700 hover:bg-red-50"
        onClick={() => setConfirming(true)}
      >
        <Trash2 size={14} /> Delete applicant + all data
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        className="bg-red-600 hover:bg-red-700"
        onClick={execute}
        disabled={busy}
      >
        {busy ? "Deleting…" : "Confirm — delete everything"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => { setConfirming(false); setMessage(null); }}
        disabled={busy}
      >
        Cancel
      </Button>
      {message && <span className="text-xs text-red-700">{message}</span>}
    </div>
  );
}
