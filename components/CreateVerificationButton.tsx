"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function CreateVerificationButton({ applicationId }: { applicationId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function createChecklist() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/hr/applications/${applicationId}/verification/create`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Checklist could not be created.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-2">
      <Button type="button" onClick={createChecklist} disabled={busy}>{busy ? "Creating..." : "Create Final Verification Checklist"}</Button>
      {message && <p className="text-sm text-orange-700">{message}</p>}
    </div>
  );
}
