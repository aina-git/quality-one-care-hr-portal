"use client";

import type { TaskCategory, TaskPriority } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";
import { useState } from "react";

const categories: TaskCategory[] = ["application_review", "verification", "onboarding", "training", "license_followup", "document_request", "interview", "general"];
const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];

export function TaskForm({ applicationId, applicantUserId }: { applicationId?: string; applicantUserId?: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description"),
        category: form.get("category"),
        priority: form.get("priority"),
        dueDate: form.get("dueDate"),
        relatedApplicationId: applicationId || form.get("relatedApplicationId"),
        relatedApplicantUserId: applicantUserId
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Task could not be created.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-2">
      <input name="title" required placeholder="Task title" className="h-10 rounded-md border bg-white px-3 text-sm md:col-span-2" />
      <select name="category" defaultValue="general" className="h-10 rounded-md border bg-white px-3 text-sm">{categories.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select>
      <select name="priority" defaultValue="normal" className="h-10 rounded-md border bg-white px-3 text-sm">{priorities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <input name="dueDate" type="datetime-local" className="h-10 rounded-md border bg-white px-3 text-sm" />
      {!applicationId ? <input name="relatedApplicationId" placeholder="Related application ID optional" className="h-10 rounded-md border bg-white px-3 text-sm" /> : <div />}
      <textarea name="description" rows={3} placeholder="Description" className="rounded-md border bg-white px-3 py-2 text-sm md:col-span-2" />
      <Button type="submit" disabled={busy}>{busy ? "Creating..." : "Create Task"}</Button>
      {message ? <p className="text-sm text-orange-700">{message}</p> : null}
    </form>
  );
}
