"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function RunReviewButton({ applicationId, hasReport }: { applicationId: string; hasReport: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function runReview() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/hr/applications/${applicationId}/run-review`, {
      method: "POST",
      headers: getCsrfHeaders()
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Review could not be generated.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-2">
      <Button type="button" onClick={runReview} disabled={busy}>
        {busy ? "Running Review..." : hasReport ? "Rerun Review" : "Run Review"}
      </Button>
      {message && <p className="text-sm text-orange-700">{message}</p>}
    </div>
  );
}
