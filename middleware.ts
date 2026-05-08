import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { validateEnvironment } from "@/lib/env";
import { createRequestId } from "@/lib/security";

const SESSION_COOKIE = "qoc_session";
const CSRF_COOKIE = "qoc_csrf";
const DEFAULT_SECRET = "development-only-change-me";

const pageProtectedRoutes: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/applicant", roles: ["applicant"] },
  { prefix: "/calendar", roles: ["applicant", "hr", "admin", "super_admin_hr", "don_approver", "executive_view_only", "scheduler_limited"] },
  { prefix: "/tasks", roles: ["applicant", "hr", "admin", "super_admin_hr", "don_approver", "executive_view_only", "scheduler_limited"] },
  { prefix: "/notifications", roles: ["applicant", "hr", "admin", "super_admin_hr", "don_approver", "executive_view_only", "scheduler_limited"] },
  { prefix: "/hr/log-review", roles: ["admin", "super_admin_hr"] },
  { prefix: "/hr", roles: ["hr", "admin", "super_admin_hr", "don_approver", "executive_view_only"] },
  { prefix: "/admin/users", roles: ["admin", "super_admin_hr"] },
  { prefix: "/admin", roles: ["admin", "super_admin_hr", "executive_view_only"] },
  { prefix: "/don", roles: ["admin", "super_admin_hr", "don_approver", "executive_view_only"] },
  { prefix: "/scheduler", roles: ["scheduler_limited", "admin", "super_admin_hr"] }
];

const apiProtectedRoutes: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/api/applicant", roles: ["applicant"] },
  { prefix: "/api/calendar", roles: ["applicant", "hr", "admin", "super_admin_hr", "don_approver", "scheduler_limited"] },
  { prefix: "/api/tasks", roles: ["applicant", "hr", "admin", "super_admin_hr", "scheduler_limited"] },
  { prefix: "/api/reminders", roles: ["applicant", "hr", "admin", "super_admin_hr", "don_approver", "scheduler_limited"] },
  { prefix: "/api/messages", roles: ["hr", "admin", "super_admin_hr", "don_approver", "scheduler_limited"] },
  { prefix: "/api/notifications", roles: ["applicant", "hr", "admin", "super_admin_hr", "don_approver", "executive_view_only", "scheduler_limited"] },
  { prefix: "/api/application", roles: ["applicant"] },
  { prefix: "/api/documents", roles: ["applicant", "hr", "admin", "super_admin_hr", "don_approver"] },
  { prefix: "/api/intake", roles: ["applicant"] },
  { prefix: "/api/hr", roles: ["hr", "admin", "super_admin_hr"] },
  { prefix: "/api/don", roles: ["admin", "super_admin_hr", "don_approver"] },
  { prefix: "/api/todos", roles: ["applicant", "hr", "admin", "super_admin_hr", "don_approver", "executive_view_only", "scheduler_limited"] },
  { prefix: "/api/admin/users", roles: ["admin", "super_admin_hr"] },
  { prefix: "/api/admin", roles: ["admin", "super_admin_hr"] },
  { prefix: "/api/address", roles: ["applicant", "hr", "admin", "super_admin_hr", "don_approver", "scheduler_limited"] }
];

const rateLimitRules = [
  { path: "/api/auth/login", limit: 8, windowMs: 10 * 60 * 1000 },
  { path: "/api/auth/register", limit: 5, windowMs: 10 * 60 * 1000 },
  { path: "/api/auth/recovery/request", limit: 5, windowMs: 15 * 60 * 1000 },
  { path: "/api/auth/recovery/verify", limit: 10, windowMs: 15 * 60 * 1000 },
  { path: "/api/auth/recovery/reset", limit: 5, windowMs: 15 * 60 * 1000 },
  { path: "/api/documents/upload", limit: 12, windowMs: 10 * 60 * 1000 }
];

const globalForRateLimit = globalThis as unknown as {
  qocRateLimitStore?: Map<string, { count: number; resetAt: number }>;
};

const rateLimitStore = globalForRateLimit.qocRateLimitStore ?? new Map<string, { count: number; resetAt: number }>();
globalForRateLimit.qocRateLimitStore = rateLimitStore;

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? DEFAULT_SECRET);
}

function roleHome(role: Role) {
  if (role === "admin" || role === "super_admin_hr") return "/admin/dashboard";
  if (role === "hr" || role === "don_approver" || role === "executive_view_only") return "/hr/dashboard";
  if (role === "scheduler_limited") return "/scheduler/dashboard";
  return "/applicant/dashboard";
}

function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const expectedOrigins = new Set<string>([request.nextUrl.origin]);
  if (forwardedHost) expectedOrigins.add(`${forwardedProto}://${forwardedHost}`);
  if (origin) return expectedOrigins.has(origin);
  if (referer) {
    try {
      return expectedOrigins.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  return false;
}

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${process.env.NODE_ENV === "development" ? "ws: wss:" : ""}`.trim(),
    "object-src 'none'"
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Cache-Control", request.nextUrl.pathname.startsWith("/api/") ? "no-store" : "private, no-store");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function jsonError(message: string, status: number, request: NextRequest) {
  const response = NextResponse.json({ error: message }, { status });
  applySecurityHeaders(response, request);
  return response;
}

function redirectResponse(location: string, request: NextRequest) {
  const response = NextResponse.redirect(new URL(location, request.url));
  applySecurityHeaders(response, request);
  return response;
}

async function getRoleFromToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.role as Role;
  } catch {
    return null;
  }
}

function enforceRateLimit(request: NextRequest) {
  const rule = rateLimitRules.find((entry) => request.nextUrl.pathname === entry.path);
  if (!rule) return null;

  const now = Date.now();
  const ip = getClientIp(request);
  const key = `${rule.path}:${ip}`;
  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + rule.windowMs });
    return null;
  }
  if (current.count >= rule.limit) {
    return jsonError("Too many requests. Please wait and try again.", 429, request);
  }
  current.count += 1;
  rateLimitStore.set(key, current);
  return null;
}

export async function middleware(request: NextRequest) {
  validateEnvironment();

  if (request.nextUrl.pathname.startsWith("/uploads/")) {
    return jsonError("File access requires authorization.", 404, request);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-qoc-request-id", createRequestId());
  requestHeaders.set("x-qoc-path", request.nextUrl.pathname);
  requestHeaders.set("x-qoc-ip", getClientIp(request));
  requestHeaders.set("x-qoc-user-agent", request.headers.get("user-agent") ?? "unknown");

  if (request.nextUrl.pathname.startsWith("/api/") && isUnsafeMethod(request.method)) {
    if (!isSameOrigin(request)) {
      return jsonError("Invalid request origin.", 403, request);
    }

    const csrfCookie = request.cookies.get(CSRF_COOKIE)?.value;
    const csrfHeader = request.headers.get("x-qoc-csrf");
    const csrfExempt = [
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/logout",
      "/api/auth/recovery/request",
      "/api/auth/recovery/verify",
      "/api/auth/recovery/reset",
      "/api/admin/analysis-settings"
    ].includes(request.nextUrl.pathname);
    if (!csrfExempt && (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader)) {
      return jsonError("Security check failed. Refresh the page and try again.", 403, request);
    }

    const limited = enforceRateLimit(request);
    if (limited) return limited;
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const role = await getRoleFromToken(token);

  if ((role === "admin" || role === "super_admin_hr") && ["/notifications", "/calendar", "/tasks"].includes(request.nextUrl.pathname)) {
    return redirectResponse(`/admin${request.nextUrl.pathname}`, request);
  }
  if (role === "applicant" && (request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/hr") || request.nextUrl.pathname.startsWith("/don") || request.nextUrl.pathname.startsWith("/scheduler"))) {
    return redirectResponse("/applicant/dashboard", request);
  }

  const apiMatch = apiProtectedRoutes.find((route) => request.nextUrl.pathname.startsWith(route.prefix));
  if (apiMatch) {
    if (!role) return jsonError("Authentication required.", 401, request);
    if (!apiMatch.roles.includes(role)) return jsonError("You do not have permission to perform this action.", 403, request);
  }

  const pageMatch = pageProtectedRoutes.find((route) => request.nextUrl.pathname.startsWith(route.prefix));
  if (pageMatch) {
    if (!role) return redirectResponse("/login", request);
    if (!pageMatch.roles.includes(role)) return redirectResponse(roleHome(role), request);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!request.cookies.get(CSRF_COOKIE)) {
    response.cookies.set(CSRF_COOKIE, createRequestId(), {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8
    });
  }
  applySecurityHeaders(response, request);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
