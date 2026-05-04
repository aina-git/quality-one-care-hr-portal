"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function SubmitApplicationButton({ canSubmit }: { canSubmit: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/application/submit", { method: "POST", headers: getCsrfHeaders() });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Submission is blocked. Please resolve the checklist items.");
    } else {
      setMessage("Application submitted successfully.");
      window.location.reload();
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-2">
      <Button type="button" onClick={submit} disabled={!canSubmit || busy}>
        {busy ? "Submitting..." : "Submit Application"}
      </Button>
      {!canSubmit && <p className="text-sm text-orange-700">Resolve blocking items before submitting.</p>}
      {message && <p className="text-sm text-orange-700">{message}</p>}
    </div>
  );
}
