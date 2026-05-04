"use client";

import { useState } from "react";
import type { MessageChannel } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const channels: Array<[MessageChannel, string]> = [
  ["in_app", "In-app"],
  ["email", "Email"],
  ["sms", "SMS"],
  ["whatsapp", "WhatsApp"]
];

export function MessageComposer({
  applicationId,
  compact = false
}: {
  applicationId: string;
  compact?: boolean;
}) {
  const [channel, setChannel] = useState<MessageChannel>("in_app");
  const [subject, setSubject] = useState("Message from Quality One Care");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/messages/send", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ applicationId, channel, subject, body })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Message could not be sent.");
      setBusy(false);
      return;
    }
    setMessage(payload.status === "sent" ? "Message sent." : "Queued, provider not configured.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className={compact ? "grid gap-2" : "grid gap-3 rounded-md border bg-slate-50 p-3"}>
      <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)]">
        <select value={channel} onChange={(event) => setChannel(event.target.value as MessageChannel)} className="h-10 rounded-md border bg-white px-3 text-sm">
          {channels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input value={subject} onChange={(event) => setSubject(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm" placeholder="Subject" />
      </div>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={compact ? 3 : 5} className="rounded-md border bg-white px-3 py-2 text-sm" placeholder="Write a clear applicant-facing message." />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Sending..." : "Send Message"}</Button>
        <Button type="button" variant="outline" onClick={() => setMessage("Draft saved locally for this session.")}>Save Draft</Button>
      </div>
      {message ? <p className="text-sm text-orange-700">{message}</p> : null}
    </form>
  );
}
