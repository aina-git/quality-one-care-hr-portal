"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function JobRunControls({ jobKey }: { jobKey?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/jobs/run", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ jobKey })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Job run could not be started.");
      setBusy(false);
      return;
    }
    setMessage(jobKey ? "Job run completed." : "Due jobs checked.");
    setBusy(false);
  }

  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={busy}>
        {busy ? "Running..." : jobKey ? "Run Now" : "Run Due Jobs"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
