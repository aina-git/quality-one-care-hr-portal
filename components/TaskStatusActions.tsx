"use client";

import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function TaskStatusActions({ taskId }: { taskId: string }) {
  async function update(status: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status })
    });
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => update("completed")}>Complete</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => update("in_progress")}>In Progress</Button>
    </div>
  );
}
