"use client";

import type { Role } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const roles: Array<[Role, string]> = [
  ["applicant", "Applicant"],
  ["hr", "HR"],
  ["admin", "Admin"],
  ["super_admin_hr", "Super Admin HR"],
  ["don_approver", "DON Approver"],
  ["executive_view_only", "Executive View Only"],
  ["scheduler_limited", "Scheduler Limited"]
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
  isActive
}: {
  userId: string;
  currentRole: Role;
  isActive: boolean;
}) {
  const [role, setRole] = useState<Role>(currentRole);
  const [active, setActive] = useState(isActive);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
      </div>
      {message ? <p className="text-xs text-orange-700">{message}</p> : null}
    </div>
  );
}
