"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RecommendationBadge, RiskBadge } from "@/components/ReviewBadges";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Row = {
  id: string;
  applicantName: string;
  status: string;
  submittedLabel: string;
  reviewStatus: string;
  riskLevel: "low" | "moderate" | "high" | "incomplete_review" | null;
  recommendation:
    | "proceed_to_interview"
    | "request_clarification"
    | "hold_for_review"
    | "not_recommended_at_this_stage"
    | null;
  latestDecision: string | null;
  pediatricStrength: string;
  licenseStatus: string;
  reviewHref: string;
  verificationHref: string;
  applicantProfileHref: string;
};

export function HrApplicationsBulkActions({ rows, canAct = true }: { rows: Row[]; canAct?: boolean }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [action, setAction] = useState("send_reminder");
  const [note, setNote] = useState("Please review your application and complete any remaining steps.");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const allSelected = useMemo(() => rows.length > 0 && selectedIds.length === rows.length, [rows.length, selectedIds.length]);

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : rows.map((row) => row.id));
  }

  async function submitBulk() {
    if (!selectedIds.length) {
      setMessage("Select at least one application.");
      return;
    }
    if (action === "export_selected") {
      window.location.href = `/api/hr/applications/export?ids=${selectedIds.join(",")}`;
      return;
    }

    setBusy(true);
    setMessage("");
    const response = await fetch("/api/hr/applications/bulk", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        action,
        note,
        applicationIds: selectedIds
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Bulk action could not be completed.");
      setBusy(false);
      return;
    }

    setMessage(`Bulk action completed for ${payload.updated ?? selectedIds.length} application(s).`);
    setBusy(false);
    window.location.reload();
  }

  return (
    <div className="grid gap-4">
      {canAct ? <div className="grid gap-3 rounded-md border bg-slate-50 p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Bulk Action</span>
            <select value={action} onChange={(event) => setAction(event.target.value)} className="h-10 rounded-md border bg-white px-3">
              <option value="send_reminder">Send Bulk Reminder</option>
              <option value="mark_reviewed">Mark Selected as Reviewed</option>
              <option value="export_selected">Export Selected</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Note</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={action !== "send_reminder"}
              className="h-10 rounded-md border bg-white px-3"
            />
          </label>
          <div className="flex items-end">
            <Button type="button" onClick={submitBulk} disabled={busy}>
              {busy ? "Working..." : "Run Bulk Action"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{selectedIds.length} selected</p>
        {message ? <p className="text-sm text-orange-700">{message}</p> : null}
      </div> : null}

      <Table>
        <TableHeader>
          <TableRow>
            {canAct ? <TableHead className="w-10">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all applications" />
            </TableHead> : null}
            <TableHead>Applicant Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date Submitted</TableHead>
            <TableHead>Review Status</TableHead>
            <TableHead>Risk Level</TableHead>
            <TableHead>Recommendation</TableHead>
            <TableHead>Pediatric</TableHead>
            <TableHead>License</TableHead>
            <TableHead>Latest Decision</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {canAct ? <TableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(row.id)}
                  onChange={() => toggle(row.id)}
                  aria-label={`Select ${row.applicantName}`}
                />
              </TableCell> : null}
              <TableCell>{row.applicantName}</TableCell>
              <TableCell><StatusBadge status={row.status as never} /></TableCell>
              <TableCell>{row.submittedLabel}</TableCell>
              <TableCell className="capitalize">{row.reviewStatus}</TableCell>
              <TableCell>{row.riskLevel ? <RiskBadge risk={row.riskLevel} /> : "-"}</TableCell>
              <TableCell>{row.recommendation ? <RecommendationBadge recommendation={row.recommendation} /> : "-"}</TableCell>
              <TableCell className="capitalize">{row.pediatricStrength}</TableCell>
              <TableCell className="capitalize">{row.licenseStatus.replace(/_/g, " ")}</TableCell>
              <TableCell className="capitalize">{row.latestDecision?.replace(/_/g, " ") ?? "-"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={row.reviewHref}>View Review</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={row.verificationHref}>Final Verification</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={row.applicantProfileHref}>Applicant Profile</Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
