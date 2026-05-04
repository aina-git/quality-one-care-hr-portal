const CSRF_COOKIE = "qoc_csrf";

function readCsrfToken() {
  const match = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : "";
}

export function getCsrfHeaders(extra?: HeadersInit) {
  const token = typeof document === "undefined" ? "" : readCsrfToken();
  return {
    ...(extra ?? {}),
    "x-qoc-csrf": token
  };
}
