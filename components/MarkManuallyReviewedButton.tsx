"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function MarkManuallyReviewedButton({ applicationId }: { applicationId: string }) {
  const [busy, setBusy] = useState(false);

  async function markReviewed() {
    setBusy(true);
    await fetch(`/api/hr/applications/${applicationId}/verification/mark-reviewed`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" })
    });
    window.location.reload();
  }

  return <Button type="button" size="sm" variant="outline" onClick={markReviewed} disabled={busy}>{busy ? "Saving..." : "Mark Reviewed"}</Button>;
}
