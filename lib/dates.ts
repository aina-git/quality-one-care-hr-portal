// Canonical date formatting for the QOC HR portal.
// MM/DD/YYYY everywhere user-facing, regardless of server locale.

export function formatDate(value: Date | string | null | undefined, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

export function formatDateTime(value: Date | string | null | undefined, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${formatDate(d)} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
}

/**
 * Convert "YYYY-MM-DD" (HTML <input type="date"> shape) to MM/DD/YYYY for display.
 * Used when a stored ISO date string needs to be shown without parsing through
 * the Date constructor (which can shift to local timezone for date-only values).
 */
export function formatIsoDate(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return formatDate(iso, fallback);
  return `${m[2]}/${m[3]}/${m[1]}`;
}
