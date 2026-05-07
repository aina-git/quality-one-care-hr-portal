"use client";

import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const REQUIRED_PHRASE = "DELETE ALL OTHER USERS";

type CleanupResult = {
  deletedUserCount: number;
  preservedApplicantCount: number;
  preservedApplicants: string[];
  deletedNotificationCount: number;
  deletedSystemAlertCount: number;
  failureCount: number;
};

export function UserCleanupDangerZone({ actorEmail }: { actorEmail: string }) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [result, setResult] = useState<CleanupResult | null>(null);

  async function execute() {
    if (phrase !== REQUIRED_PHRASE) {
      setMessage({ tone: "err", text: `Type the phrase exactly: ${REQUIRED_PHRASE}` });
      return;
    }
    if (!confirm(`This will permanently delete every user except ${actorEmail} (plus any applicant whose application is preserved), and wipe all notifications and system alerts. This cannot be undone. Continue?`)) {
      return;
    }
    setBusy(true);
    setMessage(null);
    setResult(null);
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
      setResult({
        deletedUserCount: payload.deletedUserCount ?? 0,
        preservedApplicantCount: payload.preservedApplicantCount ?? 0,
        preservedApplicants: payload.preservedApplicants ?? [],
        deletedNotificationCount: payload.deletedNotificationCount ?? 0,
        deletedSystemAlertCount: payload.deletedSystemAlertCount ?? 0,
        failureCount: payload.failureCount ?? 0
      });
      setMessage({
        tone: "ok",
        text: `Cleanup complete. Reloading…`
      });
      setTimeout(() => window.location.reload(), 1800);
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
          <h3 className="font-semibold text-red-900">Danger Zone — Reset users &amp; alerts</h3>
          <div className="mt-2 grid gap-2 text-sm text-red-800">
            <p>
              Permanently deletes:
            </p>
            <ul className="ml-4 list-disc">
              <li>Every user account <span className="font-semibold">except</span> <span className="font-mono">{actorEmail}</span></li>
              <li>All notifications (clears the inflated alert badge)</li>
              <li>All operational system alerts</li>
            </ul>
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-emerald-900">
              <p className="flex items-start gap-2 text-sm font-semibold">
                <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" />
                Real applicants are protected
              </p>
              <p className="mt-1 text-xs">
                Any applicant whose application has been submitted (status != draft) is automatically preserved. Their application data stays intact.
              </p>
            </div>
            <p className="font-semibold">This cannot be undone.</p>
          </div>
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
                  {busy ? "Cleaning up…" : "Run cleanup"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setOpen(false); setPhrase(""); setMessage(null); setResult(null); }}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
              {message && (
                <p className={message.tone === "ok" ? "text-sm text-emerald-800" : "text-sm text-red-800"}>{message.text}</p>
              )}
              {result && (
                <div className="rounded-md border border-emerald-200 bg-white p-3 text-xs text-slate-700">
                  <p className="font-semibold text-emerald-800">Cleanup summary</p>
                  <ul className="mt-1 grid gap-0.5">
                    <li>Users deleted: <span className="font-semibold">{result.deletedUserCount}</span></li>
                    <li>Applicants preserved: <span className="font-semibold">{result.preservedApplicantCount}</span> {result.preservedApplicants.length > 0 && <span className="text-slate-500">({result.preservedApplicants.join(", ")})</span>}</li>
                    <li>Notifications deleted: <span className="font-semibold">{result.deletedNotificationCount}</span></li>
                    <li>System alerts deleted: <span className="font-semibold">{result.deletedSystemAlertCount}</span></li>
                    {result.failureCount > 0 && <li className="text-amber-700">Failures: <span className="font-semibold">{result.failureCount}</span></li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
