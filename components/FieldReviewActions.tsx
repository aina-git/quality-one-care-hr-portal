"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function FieldReviewActions({ fieldId, currentValue }: { fieldId: string; currentValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(currentValue);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function post(action: "accept" | "correct" | "reject") {
    try {
      setBusy(true);
      setMessage("");
      const response = await fetch(`/api/intake/field/${fieldId}/${action}`, {
        method: "POST",
        headers: action === "correct" ? getCsrfHeaders({ "Content-Type": "application/json" }) : getCsrfHeaders(),
        body: action === "correct" ? JSON.stringify({ value }) : undefined
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Field could not be updated.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Field could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input value={value} onChange={(event) => setValue(event.target.value)} aria-label="Corrected value" />
        <Button type="button" size="sm" onClick={() => post("accept")} disabled={busy}>Accept</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => post("correct")} disabled={busy}>Correct</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => post("reject")} disabled={busy}>Reject</Button>
      </div>
      {message ? <p className="text-xs font-medium text-red-700">{message}</p> : null}
    </div>
  );
}
