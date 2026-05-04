"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function SubmitToDonButton({ applicationId }: { applicationId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/hr/applications/${applicationId}/verification/submit-to-don`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Checklist is not ready for DON review.");
      setBusy(false);
      return;
    }
    setMessage("Checklist submitted to DON review.");
    setBusy(false);
    window.location.reload();
  }

  return (
    <div className="grid gap-2">
      <Button type="button" onClick={submit} disabled={busy}>{busy ? "Submitting..." : "Submit to DON Review"}</Button>
      {message ? <p className="text-sm text-orange-700">{message}</p> : null}
    </div>
  );
}
