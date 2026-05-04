"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function ResubmitApplicationButton({ canShow }: { canShow: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!canShow) return null;

  async function resubmit() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/applicant/resubmit", { method: "POST", headers: getCsrfHeaders() });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Application could not be resubmitted.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-2">
      <Button type="button" onClick={resubmit} disabled={busy}>{busy ? "Resubmitting..." : "Resubmit After Correction"}</Button>
      {message && <p className="text-sm text-orange-700">{message}</p>}
    </div>
  );
}
