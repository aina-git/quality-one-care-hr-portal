"use client";

import type { Role } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const roles: Array<[Role, string]> = [
  ["applicant", "Applicant / Nurse"],
  ["hr_assistant", "HR Assistant"],
  ["super_admin_hr", "HR Coordinator"],
  ["don_approver", "Director of Nursing"],
  ["executive_view_only", "CEO / Executive"],
  ["scheduler_limited", "Scheduler"]
];

export function CreateUserForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        email: form.get("email"),
        name: form.get("name"),
        password: form.get("password"),
        role: form.get("role")
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "User could not be created.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-5">
      <input name="name" placeholder="Name" className="h-10 rounded-md border bg-white px-3 text-sm" />
      <input name="email" type="email" required placeholder="Email" className="h-10 rounded-md border bg-white px-3 text-sm" />
      <input name="password" type="password" required placeholder="Temporary password" className="h-10 rounded-md border bg-white px-3 text-sm" />
      <select name="role" defaultValue="hr" className="h-10 rounded-md border bg-white px-3 text-sm">
        {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <Button type="submit" disabled={busy}>{busy ? "Creating..." : "Create User"}</Button>
      {message ? <p className="text-sm text-orange-700 md:col-span-5">{message}</p> : null}
    </form>
  );
}

export function UserRoleControl({
  userId,
  currentRole,
  isActive,
  isSelf = false
}: {
  userId: string;
  currentRole: Role;
  isActive: boolean;
  isSelf?: boolean;
}) {
  const [role, setRole] = useState<Role>(currentRole);
  const [active, setActive] = useState(isActive);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [deleteState, setDeleteState] = useState<"idle" | "confirm" | "force">("idle");

  async function save(nextActive = active) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ role, isActive: nextActive })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "User could not be updated.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  async function resetPassword() {
    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ newPassword })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Password could not be reset.");
      setBusy(false);
      return;
    }
    setMessage("Password reset successfully.");
    setShowReset(false);
    setNewPassword("");
    setBusy(false);
  }

  async function performDelete(force: boolean) {
    setBusy(true);
    setMessage("");
    const url = force ? `/api/admin/users/${userId}?force=true` : `/api/admin/users/${userId}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: getCsrfHeaders({ "Content-Type": "application/json" })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 409 && !force) {
      setMessage(payload.error ?? "This user has linked data. Click 'Force delete' to proceed anyway.");
      setDeleteState("force");
      setBusy(false);
      return;
    }
    if (!response.ok) {
      setMessage(payload.error ?? "User could not be deleted.");
      setBusy(false);
      setDeleteState("idle");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-2">
      <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="h-9 rounded-md border bg-white px-2 text-sm">
        {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="button" onClick={() => save()} disabled={busy}>Save</Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => {
            setActive(!active);
            void save(!active);
          }}
          disabled={busy}
        >
          {active ? "Deactivate" : "Activate"}
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={() => setShowReset(!showReset)} disabled={busy}>
          Reset Password
        </Button>
        {!isSelf && deleteState === "idle" && (
          <Button size="sm" type="button" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => setDeleteState("confirm")} disabled={busy}>
            Delete
          </Button>
        )}
        {deleteState === "confirm" && (
          <>
            <Button size="sm" type="button" className="bg-red-600 hover:bg-red-700" onClick={() => performDelete(false)} disabled={busy}>
              {busy ? "Deleting…" : "Confirm delete"}
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={() => { setDeleteState("idle"); setMessage(""); }} disabled={busy}>Cancel</Button>
          </>
        )}
        {deleteState === "force" && (
          <>
            <Button size="sm" type="button" className="bg-red-600 hover:bg-red-700" onClick={() => performDelete(true)} disabled={busy}>
              {busy ? "Deleting…" : "Force delete"}
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={() => { setDeleteState("idle"); setMessage(""); }} disabled={busy}>Cancel</Button>
          </>
        )}
      </div>
      {showReset && (
        <div className="flex gap-2 mt-1">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (8+ chars)"
            className="h-8 flex-1 rounded-md border bg-white px-2 text-sm"
          />
          <Button size="sm" type="button" onClick={resetPassword} disabled={busy || newPassword.length < 8}>Set</Button>
        </div>
      )}
      {message ? <p className="text-xs text-orange-700">{message}</p> : null}
    </div>
  );
}
