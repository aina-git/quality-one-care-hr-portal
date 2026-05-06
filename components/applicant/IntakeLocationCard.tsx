"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsrfHeaders } from "@/lib/csrf-client";

type Location = { id: string; name: string; city: string | null };

export function IntakeLocationCard({ initialLocationId }: { initialLocationId: string | null }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<string>(initialLocationId ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/intake-locations")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLocations(data.locations ?? []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function save(value: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/applicant/application", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeaders() },
        body: JSON.stringify({ intakeLocationId: value || null })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error ?? "Could not save the intake location.");
      } else {
        setMessage("Saved.");
      }
    } finally {
      setSaving(false);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setSelected(value);
    void save(value);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin size={18} className="text-orange-600" /> Intake location
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-slate-600 mb-3">
          Where did you apply? Pick the clinic or office that took your application.
        </p>
        {loading ? (
          <p className="text-sm text-slate-500">Loading locations…</p>
        ) : locations.length === 0 ? (
          <p className="text-sm text-slate-500">
            No intake locations are set up yet. HR can add them from the admin area.
          </p>
        ) : (
          <select
            value={selected}
            onChange={onChange}
            disabled={saving}
            className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-60"
          >
            <option value="">— Not specified —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}{l.city ? ` · ${l.city}` : ""}
              </option>
            ))}
          </select>
        )}
        {message && <p className="mt-2 text-xs text-slate-500">{message}</p>}
      </CardContent>
    </Card>
  );
}
