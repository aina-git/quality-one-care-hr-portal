"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const NEXT_LABEL: Record<string, { next: string; label: string }> = {
  recommended: { next: "assigned", label: "Assign" },
  assigned: { next: "completed", label: "Mark complete" }
};

export function TrainingStatusActions({
  trainingId,
  currentStatus
}: {
  trainingId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update(status: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/hr/training/${trainingId}`, {
        method: "PATCH",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status })
      });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const next = NEXT_LABEL[currentStatus];
  if (!next && currentStatus !== "waived") return <span className="text-xs text-slate-400 italic">No actions</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {next && (
        <Button type="button" size="sm" onClick={() => update(next.next)} disabled={busy}>{next.label}</Button>
      )}
      {currentStatus !== "completed" && currentStatus !== "waived" && (
        <Button type="button" size="sm" variant="outline" onClick={() => update("waived")} disabled={busy}>Waive</Button>
      )}
    </div>
  );
}
