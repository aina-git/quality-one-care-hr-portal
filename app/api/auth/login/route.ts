import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, getRoleHome } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { AppError, handleApiError } from "@/services/monitoring/errorService";
import { readCookieValue, sanitizeEmail, sanitizeText } from "@/lib/security";
import { publicUrl } from "@/lib/publicUrl";

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const email = sanitizeEmail(body.get("email"));
    const password = sanitizeText(body.get("password"), 256);
    const csrfToken = sanitizeText(body.get("csrfToken"), 200);
    const csrfCookie = readCookieValue(request.headers.get("cookie"), "qoc_csrf");

    if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
      throw new AppError("Security check failed. Refresh the page and try again.", { statusCode: 403, code: "CSRF_INVALID" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await logAction(null, "auth.login_failed", "auth", null, { email, reason: "unknown_user" });
      return NextResponse.redirect(publicUrl("/login?error=invalid", request));
    }
    if (!user.isActive) {
      await logAction(user.id, "auth.login_failed", "user", user.id, { role: user.role, reason: "inactive_user" });
      return NextResponse.redirect(publicUrl("/login?error=invalid", request));
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await logAction(user.id, "auth.login_failed", "user", user.id, { role: user.role, reason: "invalid_password" });
      return NextResponse.redirect(publicUrl("/login?error=invalid", request));
    }

    await logAction(user.id, "auth.login", "user", user.id, { role: user.role });
    await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });

    return NextResponse.redirect(publicUrl(getRoleHome(user.role), request));
  } catch (error) {
    return handleApiError(error, {
      scope: "auth.login",
      action: "api_failure",
      entityType: "auth",
      fallbackMessage: "Login failed."
    });
  }
}
