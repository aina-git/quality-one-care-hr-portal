"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const REQUIRED_PHRASE = "DELETE ALL OTHER USERS";

export function UserCleanupDangerZone({ actorEmail }: { actorEmail: string }) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function execute() {
    if (phrase !== REQUIRED_PHRASE) {
      setMessage({ tone: "err", text: `Type the phrase exactly: ${REQUIRED_PHRASE}` });
      return;
    }
    if (!confirm(`This will permanently delete every user except ${actorEmail} and all of their applications, documents, and related data. This cannot be undone. Continue?`)) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users/cleanup", {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ confirmation: phrase })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ tone: "err", text: payload.error ?? "Cleanup failed." });
        return;
      }
      setMessage({
        tone: "ok",
        text: `Deleted ${payload.deletedCount} user${payload.deletedCount === 1 ? "" : "s"}${payload.failureCount > 0 ? ` (${payload.failureCount} failed)` : ""}. Reloading…`
      });
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setMessage({ tone: "err", text: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-md border-2 border-red-300 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={22} className="text-red-700 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900">Danger Zone — Reset users</h3>
          <p className="mt-1 text-sm text-red-800">
            Permanently deletes every user account except <span className="font-mono font-semibold">{actorEmail}</span>, and ensures your role is Super Admin HR. Cascades to applicant profiles, applications, documents, verifications, and notifications. <span className="font-semibold">This cannot be undone.</span>
          </p>
          {!open ? (
            <Button
              type="button"
              className="mt-3 bg-red-600 hover:bg-red-700"
              onClick={() => setOpen(true)}
            >
              Open reset panel
            </Button>
          ) : (
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-red-900">Type <span className="font-mono">{REQUIRED_PHRASE}</span> to confirm</span>
                <input
                  type="text"
                  className="h-10 rounded-md border border-red-300 bg-white px-3 text-sm"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={execute}
                  disabled={busy || phrase !== REQUIRED_PHRASE}
                >
                  {busy ? "Deleting…" : `Delete every user except ${actorEmail}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setOpen(false); setPhrase(""); setMessage(null); }}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
              {message && (
                <p className={message.tone === "ok" ? "text-sm text-emerald-800" : "text-sm text-red-800"}>{message.text}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
