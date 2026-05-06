"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Play, RefreshCw, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Settings = {
  enabled: boolean;
  excelPath: string;
  worksheetName?: string;
  hrCopyEmails: string[];
  subjectPrefix: string;
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
  excelPath: "",
  worksheetName: "",
  hrCopyEmails: [],
  subjectPrefix: "Credential expiration notice"
};

function bucketLabel(bucket: string) {
  if (bucket === "expired") return "Expired";
  if (bucket === "lt15") return "< 15 days";
  if (bucket === "lt30") return "< 30 days";
  if (bucket === "lt60") return "< 60 days";
  return "< 90 days";
}

export function ExcelCredentialMonitorPanel() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
      body: JSON.stringify(settings)
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
      setMessage(`Uploaded ${payload.filename} (${Math.round(payload.bytes / 1024)} KB) to persistent storage.`);
      await preview();
    } else {
      setMessage(payload.error ?? "Upload failed.");
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
              <Upload size={16} /> Upload Excel
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
            <Button type="button" onClick={() => run(false)} disabled={busy}>
              <Play size={16} /> Run Due
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="excelPath">Excel file path</Label>
              <Input
                id="excelPath"
                value={settings.excelPath}
                onChange={(event) => setSettings({ ...settings, excelPath: event.target.value })}
                placeholder="C:\Users\honpa\Documents\nurses.xlsx"
              />
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
            <div className="grid gap-2">
              <Label htmlFor="hrCopyEmails">HR copy emails</Label>
              <textarea
                id="hrCopyEmails"
                className="min-h-20 rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={settings.hrCopyEmails.join("\n")}
                onChange={(event) => setSettings({ ...settings, hrCopyEmails: event.target.value.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean) })}
                placeholder="Optional. One email per line."
              />
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
            <Button type="button" variant="outline" onClick={() => run(true)} disabled={busy}>
              <Mail size={16} /> Send All Now
            </Button>
            {message ? <p className="text-xs text-slate-600">{message}</p> : null}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Expected columns: nurse name, email, email to SMS, document or license type, expiration date.
        </p>
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
                <TableCell>{new Date(row.expiresAt).toLocaleDateString()}</TableCell>
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
