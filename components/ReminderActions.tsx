"use client";

import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function ReminderActions({ reminderId }: { reminderId: string }) {
  async function dismiss() {
    await fetch(`/api/reminders/${reminderId}/dismiss`, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" })
    });
    window.location.reload();
  }

  return <Button type="button" size="sm" variant="outline" onClick={dismiss}>Dismiss</Button>;
}
