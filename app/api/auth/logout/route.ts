import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { readCookieValue, sanitizeText } from "@/lib/security";

async function performLogout(request: Request) {
  const session = await getSession();
  if (session) {
    await logAction(session.id, "auth.logout", "user", session.id, { role: session.role });
  }
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function GET(request: Request) {
  return performLogout(request);
}

export async function POST(request: Request) {
  const csrfCookie = readCookieValue(request.headers.get("cookie"), "qoc_csrf");
  const csrfHeader = sanitizeText(request.headers.get("x-qoc-csrf"), 200);
  if (csrfCookie && csrfHeader && csrfCookie === csrfHeader) {
    return performLogout(request);
  }
  return performLogout(request);
}
