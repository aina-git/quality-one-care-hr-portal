export function sanitizeText(value: unknown, maxLength = 5000) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeEmail(value: unknown) {
  return sanitizeText(value, 320).toLowerCase();
}

export function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").slice(0, 120);
}

export function parsePositiveInt(value: unknown, fallback: number, max = 100) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function buildPagination(pageValue: unknown, pageSizeValue: unknown, defaultPageSize = 10, maxPageSize = 50) {
  const page = parsePositiveInt(pageValue, 1, 100000);
  const pageSize = parsePositiveInt(pageSizeValue, defaultPageSize, maxPageSize);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function createRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `qoc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function readCookieValue(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const match = cookies.find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
