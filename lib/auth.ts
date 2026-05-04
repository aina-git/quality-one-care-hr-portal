import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import type { SessionUser } from "@/types/auth";

const SESSION_COOKIE = "qoc_session";
const DEFAULT_SECRET = "development-only-change-me";

function getSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? DEFAULT_SECRET);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: payload.name ? String(payload.name) : null,
      role: payload.role as Role
    };
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireAuth();
  if (!hasRoleAccess(session.role, roles)) {
    redirect(getRoleHome(session.role));
  }
  return session;
}

export function getRoleHome(role: Role) {
  if (role === "admin" || role === "super_admin_hr") return "/admin/dashboard";
  if (role === "hr" || role === "don_approver" || role === "executive_view_only") return "/hr/dashboard";
  if (role === "scheduler_limited") return "/scheduler/dashboard";
  return "/applicant/dashboard";
}

export function hasRoleAccess(role: Role, roles: Role[]) {
  if (roles.includes(role)) return true;
  if (role === "super_admin_hr" && (roles.includes("admin") || roles.includes("hr"))) return true;
  return false;
}
