import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { AppError, handleApiError } from "@/services/monitoring/errorService";
import { readCookieValue, sanitizeText } from "@/lib/security";
import { verifyRecoveryCode } from "@/services/auth/passwordRecoveryService";

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const csrfToken = sanitizeText(body.get("csrfToken"), 200);
    const csrfCookie = readCookieValue(request.headers.get("cookie"), "qoc_csrf");
    if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
      throw new AppError("Security check failed. Refresh the page and try again.", { statusCode: 403, code: "CSRF_INVALID" });
    }
    const requestHeaders = await headers();
    const result = await verifyRecoveryCode({
      identifier: sanitizeText(body.get("identifier"), 320),
      code: sanitizeText(body.get("code"), 20),
      ipAddress: requestHeaders.get("x-qoc-ip"),
      userAgent: requestHeaders.get("x-qoc-user-agent")
    });
    if (!result.ok || !result.resetToken) {
      return NextResponse.redirect(new URL("/verify-recovery-code?error=invalid", request.url));
    }
    return NextResponse.redirect(new URL(`/reset-password?token=${encodeURIComponent(result.resetToken)}`, request.url));
  } catch (error) {
    return handleApiError(error, {
      scope: "password_recovery.verify",
      action: "api_failure",
      entityType: "password_recovery",
      fallbackMessage: "Recovery code verification failed."
    });
  }
}
