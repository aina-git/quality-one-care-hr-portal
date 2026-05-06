"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

export function NewIntakeLocationForm() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Location name is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/intake-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({ name: name.trim(), city: city.trim() || null })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Could not save the location.");
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch (err) {
      setError("Could not save the location.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border bg-slate-50 p-4 md:grid-cols-3 md:items-end">
      <label className="grid gap-1 text-sm md:col-span-1">
        <span className="font-medium">Name *</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Toronto Main Clinic"
          className="h-10 rounded-md border bg-white px-3"
          maxLength={120}
          required
        />
      </label>
      <label className="grid gap-1 text-sm md:col-span-1">
        <span className="font-medium">City</span>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Toronto"
          className="h-10 rounded-md border bg-white px-3"
          maxLength={120}
        />
      </label>
      <div className="md:col-span-1">
        <Button type="submit" disabled={busy} className="w-full md:w-auto">
          <Plus size={14} /> {busy ? "Adding…" : "Add location"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-700 md:col-span-3">{error}</p>}
    </form>
  );
}
