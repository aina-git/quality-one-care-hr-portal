"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function OnboardingItemActions({ itemId, currentStatus }: { itemId: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function update(nextStatus = status) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/hr/onboarding/items/${itemId}`, {
      method: "PATCH",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status: nextStatus })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Onboarding item could not be updated.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-2">
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        className="h-9 rounded-md border bg-white px-2 text-sm"
      >
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
        <option value="waived">Waived</option>
      </select>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => update()} disabled={busy}>Save</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => update("completed")} disabled={busy}>Complete</Button>
      </div>
      {message && <p className="text-xs text-orange-700">{message}</p>}
    </div>
  );
}
