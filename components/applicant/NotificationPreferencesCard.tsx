"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import { SMS_CARRIERS } from "@/services/notifications/smsGateway";

type Props = {
  applicantEmail: string;
  defaultPhone: string;
  defaultCarrier: string;
  defaultSmsOverride: string;
  defaultOptIn: boolean;
};

export function NotificationPreferencesCard(props: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState(props.defaultPhone);
  const [carrier, setCarrier] = useState(props.defaultCarrier);
  const [smsOverride, setSmsOverride] = useState(props.defaultSmsOverride);
  const [optIn, setOptIn] = useState(props.defaultOptIn);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/applicant/profile", {
        method: "PATCH",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          phone,
          phoneCarrier: carrier,
          smsEmailOverride: smsOverride,
          notificationOptIn: optIn
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Could not save." });
        return;
      }
      setMessage({ tone: "ok", text: "Notification preferences saved." });
      router.refresh();
    } catch {
      setMessage({ tone: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell size={18} className="text-orange-600" /> Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-slate-600">
          We&apos;ll email you at <span className="font-mono text-slate-900">{props.applicantEmail}</span> whenever your application moves to a new stage. To also receive a free text message at each stage, add your mobile carrier below.
        </p>
        <form onSubmit={save} className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-800">Mobile phone (10-digit US number)</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-123-4567" />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-800">Mobile carrier</span>
            <select
              className="h-10 rounded-md border border-input bg-white px-3 text-sm"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            >
              <option value="">— Select your carrier —</option>
              {SMS_CARRIERS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              We use your carrier&apos;s free email-to-SMS gateway. Standard text rates from your carrier may apply.
            </span>
          </label>

          <details className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">Custom SMS-to-email address (advanced)</summary>
            <label className="mt-2 grid gap-1">
              <span className="text-xs text-slate-700">Use this only if your carrier isn&apos;t in the list above.</span>
              <Input
                value={smsOverride}
                onChange={(e) => setSmsOverride(e.target.value)}
                placeholder="5551234567@example-carrier-gateway.com"
              />
            </label>
          </details>

          <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={optIn}
              onChange={(e) => setOptIn(e.target.checked)}
            />
            <span>
              <span className="font-medium text-slate-800">Send me application status updates</span>
              <span className="block text-xs text-slate-600">When unchecked, we&apos;ll only contact you for action-required steps.</span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>
              <MessageSquare size={14} /> {busy ? "Saving…" : "Save preferences"}
            </Button>
            {message && (
              <p className={message.tone === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
