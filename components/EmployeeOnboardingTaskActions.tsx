"use client";

import type { OnboardingTaskStatus } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function EmployeeOnboardingTaskActions({
  taskId,
  currentStatus,
  mode = "hr"
}: {
  taskId: string;
  currentStatus: OnboardingTaskStatus;
  mode?: "hr" | "applicant";
}) {
  const [status, setStatus] = useState<OnboardingTaskStatus>(currentStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function update(nextStatus = status) {
    setBusy(true);
    setMessage("");
    const response = await fetch(mode === "applicant" ? `/api/applicant/onboarding/tasks/${taskId}` : `/api/hr/employee-onboarding/tasks/${taskId}`, {
      method: "PATCH",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status: nextStatus })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Task could not be updated.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  if (mode === "applicant") {
    return (
      <div className="grid gap-2">
        <Button type="button" size="sm" onClick={() => update("completed")} disabled={busy || currentStatus === "completed"}>
          {busy ? "Saving..." : "Mark Complete"}
        </Button>
        {message ? <p className="text-xs text-orange-700">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <select value={status} onChange={(event) => setStatus(event.target.value as OnboardingTaskStatus)} className="h-9 rounded-md border bg-white px-2 text-sm">
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
        <option value="waived">Waived</option>
      </select>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => update()} disabled={busy}>Save</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => update("completed")} disabled={busy}>Complete</Button>
      </div>
      {message ? <p className="text-xs text-orange-700">{message}</p> : null}
    </div>
  );
}
