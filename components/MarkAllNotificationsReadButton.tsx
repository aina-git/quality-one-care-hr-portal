"use client";

import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function MarkAllNotificationsReadButton() {
  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" })
    });
    window.location.reload();
  }

  return <Button type="button" variant="outline" onClick={markAllRead}>Mark All Read</Button>;
}
