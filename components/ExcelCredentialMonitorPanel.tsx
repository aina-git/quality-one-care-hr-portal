"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Play, Plus, RefreshCw, Save, Send, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Settings = {
  enabled: boolean;
  worksheetName?: string;
  hrCopyEmails: string[];
  subjectPrefix: string;
  fileName: string | null;
  fileSize: number | null;
  fileUploadedAt: string | null;
  hasFile: boolean;
};

type AlertRow = {
  nurseName: string;
  email: string;
  smsEmail: string;
  documentName: string;
  expiresAt: string;
  sourceRow: number;
  daysUntilExpiration: number;
  bucket: string;
  frequencyLabel: string;
  dueNow: boolean;
};

const emptySettings: Settings = {
  enabled: false,
  worksheetName: "",
  hrCopyEmails: [],
  subjectPrefix: "Credential expiration notice",
  fileName: null,
  fileSize: null,
  fileUploadedAt: null,
  hasFile: false
};

function bucketLabel(bucket: string) {
  if (bucket === "expired") return "Expired";
  if (bucket === "lt15") return "< 15 days";
  if (bucket === "lt30") return "< 30 days";
  if (bucket === "lt60") return "< 60 days";
  return "< 90 days";
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function ExcelCredentialMonitorPanel() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newRecipient, setNewRecipient] = useState("");
  const [recipientError, setRecipientError] = useState("");

  const counts = useMemo(() => ({
    total: rows.length,
    due: rows.filter((row) => row.dueNow).length,
    expired: rows.filter((row) => row.bucket === "expired").length,
    soon: rows.filter((row) => row.bucket !== "expired").length
  }), [rows]);

  async function loadSettings() {
    const response = await fetch("/api/admin/excel-monitor/settings");
    const payload = await response.json();
    if (response.ok) setSettings(payload.settings);
  }

  async function preview() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/excel-monitor/preview");
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setRows(payload.rows ?? []);
      setWarnings(payload.warnings ?? []);
      setMessage("Preview refreshed.");
    } else {
      setMessage(payload.error ?? "Preview failed.");
    }
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/excel-monitor/settings", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        enabled: settings.enabled,
        worksheetName: settings.worksheetName,
        hrCopyEmails: settings.hrCopyEmails,
        subjectPrefix: settings.subjectPrefix
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setSettings(payload.settings);
      setMessage("Settings saved.");
      await preview();
    } else {
      setMessage(payload.error ?? "Settings could not be saved.");
    }
    setBusy(false);
  }

  async function run(force = false) {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/excel-monitor/run", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ force })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      const result = payload.result;
      setMessage(`Scanned ${result.scanned}. Queued ${result.sent}. Skipped ${result.skipped}.`);
      setWarnings(result.warnings ?? []);
      await preview();
    } else {
      setMessage(payload.error ?? "Monitor run failed.");
    }
    setBusy(false);
  }

  async function handleUpload(file: File) {
    setBusy(true);
    setMessage("");
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/admin/excel-monitor/upload", {
      method: "POST",
      headers: getCsrfHeaders(),
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setSettings(payload.settings);
      setMessage(`Uploaded ${payload.filename} (${formatBytes(payload.bytes)}).`);
      await preview();
    } else {
      setMessage(payload.error ?? "Upload failed.");
    }
    setBusy(false);
  }

  async function addRecipient() {
    const trimmed = newRecipient.trim();
    if (!trimmed) {
      setRecipientError("Enter an email address.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setRecipientError("That doesn't look like a valid email address.");
      return;
    }
    if (settings.hrCopyEmails.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      setRecipientError("That address is already on the list.");
      return;
    }
    const next: Settings = { ...settings, hrCopyEmails: [...settings.hrCopyEmails, trimmed] };
    setSettings(next);
    setNewRecipient("");
    setRecipientError("");
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/excel-monitor/settings", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        enabled: next.enabled,
        worksheetName: next.worksheetName,
        hrCopyEmails: next.hrCopyEmails,
        subjectPrefix: next.subjectPrefix
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setSettings(payload.settings);
      setMessage(`Added ${trimmed} to the always-notify list.`);
    } else {
      setMessage(payload.error ?? "Could not save the new recipient.");
      setSettings(settings);
    }
    setBusy(false);
  }

  async function removeRecipient(email: string) {
    const next: Settings = { ...settings, hrCopyEmails: settings.hrCopyEmails.filter((existing) => existing !== email) };
    setSettings(next);
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/excel-monitor/settings", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        enabled: next.enabled,
        worksheetName: next.worksheetName,
        hrCopyEmails: next.hrCopyEmails,
        subjectPrefix: next.subjectPrefix
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setSettings(payload.settings);
      setMessage(`Removed ${email}.`);
    } else {
      setMessage(payload.error ?? "Could not remove that recipient.");
      setSettings(settings);
    }
    setBusy(false);
  }

  async function handleTestSend() {
    const defaultRecipient = settings.hrCopyEmails[0] ?? "";
    const toEmail = window.prompt("Send a test email to which address?", defaultRecipient);
    if (!toEmail) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/email/test-send", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ toEmail })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage(`Test email sent via ${payload.provider}. Check ${toEmail}.`);
    } else {
      setMessage(payload.error ?? "Test email failed.");
    }
    setBusy(false);
  }

  async function handleRemove() {
    if (!settings.hasFile) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/excel-monitor/upload", {
      method: "DELETE",
      headers: getCsrfHeaders()
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setSettings(payload.settings);
      setRows([]);
      setMessage("Uploaded workbook removed.");
    } else {
      setMessage(payload.error ?? "Could not remove workbook.");
    }
    setBusy(false);
  }

  useEffect(() => {
    void loadSettings().then(preview);
  }, []);

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-orange-600">Excel Credential Monitor</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">Nurse license and document notices</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <label
              className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-white px-4 py-2 text-sm font-medium hover:bg-orange-50 hover:text-orange-700 ${busy ? "pointer-events-none opacity-50" : ""}`}
            >
              <Upload size={16} /> {settings.hasFile ? "Replace Excel" : "Upload Excel"}
              <input
                type="file"
                accept=".xlsx,.xlsm,.xls"
                className="hidden"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleUpload(file);
                }}
              />
            </label>
            <Button type="button" variant="outline" onClick={preview} disabled={busy}>
              <RefreshCw size={16} /> Preview
            </Button>
            <Button type="button" onClick={() => run(false)} disabled={busy || !settings.hasFile}>
              <Play size={16} /> Run Due
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid gap-4">
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              {settings.hasFile ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{settings.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {formatBytes(settings.fileSize)}
                      {settings.fileUploadedAt ? ` - uploaded ${formatUploadedAt(settings.fileUploadedAt)}` : ""}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleRemove} disabled={busy}>
                    <Trash2 size={14} /> Remove
                  </Button>
                </div>
              ) : (
                <p className="text-slate-600">No workbook uploaded yet. Use Upload Excel to add one. The file is stored in the database, so it survives Railway redeploys.</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="worksheetName">Worksheet name</Label>
                <Input
                  id="worksheetName"
                  value={settings.worksheetName ?? ""}
                  onChange={(event) => setSettings({ ...settings, worksheetName: event.target.value })}
                  placeholder="Leave blank for first sheet"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subjectPrefix">Subject prefix</Label>
                <Input
                  id="subjectPrefix"
                  value={settings.subjectPrefix}
                  onChange={(event) => setSettings({ ...settings, subjectPrefix: event.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="grid gap-3 rounded-md border bg-slate-50 p-4 text-sm">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
              />
              Monitor enabled
            </label>
            <Button type="button" onClick={save} disabled={busy}>
              <Save size={16} /> Save Settings
            </Button>
            <Button type="button" variant="outline" onClick={() => run(true)} disabled={busy || !settings.hasFile}>
              <Mail size={16} /> Send All Now
            </Button>
            <Button type="button" variant="outline" onClick={handleTestSend} disabled={busy}>
              <Send size={16} /> Send Test Email
            </Button>
            {message ? <p className="text-xs text-slate-600">{message}</p> : null}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Expected columns: nurse name, email, email to SMS, document or license type, expiration date.
        </p>
      </section>

      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Always notify these extra addresses</h2>
            <p className="mt-1 text-sm text-slate-600">
              Anyone added here gets a copy of every credential alert, even if they aren&apos;t listed in the uploaded Excel. Useful for HR managers, supervisors, or a personal backup mailbox.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="grid min-w-[260px] flex-1 gap-2">
            <Label htmlFor="newRecipient">Email address</Label>
            <Input
              id="newRecipient"
              type="email"
              autoComplete="email"
              value={newRecipient}
              onChange={(event) => {
                setNewRecipient(event.target.value);
                if (recipientError) setRecipientError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addRecipient();
                }
              }}
              placeholder="someone@example.com"
              disabled={busy}
            />
          </div>
          <Button type="button" onClick={addRecipient} disabled={busy || !newRecipient.trim()}>
            <Plus size={16} /> Add recipient
          </Button>
        </div>
        {recipientError ? <p className="mt-2 text-sm text-red-700">{recipientError}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {settings.hrCopyEmails.length === 0 ? (
            <p className="text-sm italic text-slate-500">No extra recipients yet. Only the people listed in the Excel will be notified.</p>
          ) : (
            settings.hrCopyEmails.map((email) => (
              <span key={email} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-900">
                <Mail size={12} />
                {email}
                <button
                  type="button"
                  className="rounded-full p-0.5 text-blue-700 transition hover:bg-blue-100 hover:text-blue-900 disabled:opacity-40"
                  onClick={() => removeRecipient(email)}
                  disabled={busy}
                  aria-label={`Remove ${email}`}
                >
                  <X size={14} />
                </button>
              </span>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Tracked</p><p className="text-2xl font-semibold">{counts.total}</p></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Due now</p><p className="text-2xl font-semibold">{counts.due}</p></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Expired</p><p className="text-2xl font-semibold">{counts.expired}</p></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Expiring</p><p className="text-2xl font-semibold">{counts.soon}</p></div>
      </section>

      {warnings.length ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {warnings.slice(0, 5).map((warning) => <p key={warning}>{warning}</p>)}
        </section>
      ) : null}

      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nurse</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 80).map((row) => (
              <TableRow key={`${row.sourceRow}-${row.nurseName}-${row.documentName}`}>
                <TableCell>{row.nurseName}</TableCell>
                <TableCell>{row.documentName}</TableCell>
                <TableCell>{new Date(row.expiresAt).toLocaleDateString("en-US")}</TableCell>
                <TableCell>{bucketLabel(row.bucket)}</TableCell>
                <TableCell>{row.frequencyLabel}</TableCell>
                <TableCell>{row.dueNow ? "Yes" : "No"}</TableCell>
              </TableRow>
            ))}
            {!rows.length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-slate-500">No expired or upcoming credentials found.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
