"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";
import { SMS_CARRIERS } from "@/services/notifications/smsGateway";

type Props = {
  emailIsTemporary: boolean;
  phoneIsTemporary: boolean;
  currentEmail: string;
  currentPhone: string;
  currentCarrier: string;
};

/**
 * Persistent banner that shows on applicant pages whenever HR or Admin
 * created the account with placeholder contact info. The applicant can
 * confirm their real email and/or phone inline. Once both flags clear,
 * the banner disappears.
 */
export function ConfirmContactInfoBanner(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(props.emailIsTemporary ? "" : props.currentEmail);
  const [phone, setPhone] = useState(props.phoneIsTemporary ? "" : props.currentPhone);
  const [carrier, setCarrier] = useState(props.currentCarrier);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!props.emailIsTemporary && !props.phoneIsTemporary) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (props.emailIsTemporary && !email.includes("@")) {
      setError("Enter your real email address.");
      return;
    }
    if (props.phoneIsTemporary && phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid 10-digit US mobile number.");
      return;
    }
    if (props.phoneIsTemporary && !carrier) {
      setError("Select your mobile carrier so we can text you status updates.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/applicant/profile/confirm-contact", {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...(props.emailIsTemporary ? { email } : {}),
          ...(props.phoneIsTemporary ? { phone, phoneCarrier: carrier } : {})
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Could not save.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-700" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">Please confirm your contact information</p>
            <p className="mt-0.5 text-sm text-amber-800">
              {props.emailIsTemporary && props.phoneIsTemporary
                ? "Your account was created with placeholder email and phone. Update them so HR can reach you."
                : props.emailIsTemporary
                  ? "Your account was created with a placeholder email. Update it so we can email you status updates."
                  : "Your account was created with a placeholder phone number. Update it so we can text you status updates."}
            </p>
            {!open ? (
              <Button type="button" size="sm" className="mt-2 bg-amber-600 hover:bg-amber-700" onClick={() => setOpen(true)}>
                Update now
              </Button>
            ) : (
              <form onSubmit={save} className="mt-3 grid gap-3">
                {props.emailIsTemporary && (
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-amber-900 inline-flex items-center gap-1.5"><Mail size={14} /> Real email address</span>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                  </label>
                )}
                {props.phoneIsTemporary && (
                  <>
                    <label className="grid gap-1 text-sm">
                      <span className="font-medium text-amber-900 inline-flex items-center gap-1.5"><Phone size={14} /> Real mobile number</span>
                      <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-123-4567" autoComplete="tel" />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-medium text-amber-900">Mobile carrier (so we can text you)</span>
                      <select
                        value={carrier}
                        onChange={(e) => setCarrier(e.target.value)}
                        className="h-10 rounded-md border border-amber-300 bg-white px-3 text-sm"
                      >
                        <option value="">— Select your carrier —</option>
                        {SMS_CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                  </>
                )}
                {error && <p className="text-sm text-red-700">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy} className="bg-amber-600 hover:bg-amber-700">
                    {busy ? "Saving…" : "Save and continue"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
