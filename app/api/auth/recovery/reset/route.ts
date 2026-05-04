import { NextResponse } from "next/server";
import { AppError, handleApiError } from "@/services/monitoring/errorService";
import { readCookieValue, sanitizeText } from "@/lib/security";
import { resetPasswordWithToken } from "@/services/auth/passwordRecoveryService";
import { publicUrl } from "@/lib/publicUrl";

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const csrfToken = sanitizeText(body.get("csrfToken"), 200);
    const csrfCookie = readCookieValue(request.headers.get("cookie"), "qoc_csrf");
    if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
      throw new AppError("Security check failed. Refresh the page and try again.", { statusCode: 403, code: "CSRF_INVALID" });
    }
    const password = sanitizeText(body.get("password"), 256);
    const confirmPassword = sanitizeText(body.get("confirmPassword"), 256);
    if (password !== confirmPassword || password.length < 8) {
      return NextResponse.redirect(publicUrl(`/reset-password?token=${encodeURIComponent(sanitizeText(body.get("resetToken"), 200))}&error=invalid`, request));
    }
    const result = await resetPasswordWithToken({
      resetToken: sanitizeText(body.get("resetToken"), 200),
      password
    });
    if (!result.ok) return NextResponse.redirect(publicUrl("/reset-password?error=invalid", request));
    return NextResponse.redirect(publicUrl("/login?reset=success", request));
  } catch (error) {
    return handleApiError(error, {
      scope: "password_recovery.reset",
      action: "api_failure",
      entityType: "password_recovery",
      fallbackMessage: "Password reset failed."
    });
  }
}
