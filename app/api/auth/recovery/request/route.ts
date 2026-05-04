import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { AppError, handleApiError } from "@/services/monitoring/errorService";
import { readCookieValue, sanitizeText } from "@/lib/security";
import { requestPasswordRecovery } from "@/services/auth/passwordRecoveryService";
import { publicUrl } from "@/lib/publicUrl";

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const csrfToken = sanitizeText(body.get("csrfToken"), 200);
    const csrfCookie = readCookieValue(request.headers.get("cookie"), "qoc_csrf");
    if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
      throw new AppError("Security check failed. Refresh the page and try again.", { statusCode: 403, code: "CSRF_INVALID" });
    }
    const requestHeaders = await headers();
    const result = await requestPasswordRecovery({
      accountType: sanitizeText(body.get("accountType"), 30) === "staff" ? "staff" : "applicant",
      contactMethod: sanitizeText(body.get("contactMethod"), 30) === "phone" ? "phone" : "email",
      identifier: sanitizeText(body.get("identifier"), 320),
      verificationDate: sanitizeText(body.get("verificationDate"), 30),
      channel: sanitizeText(body.get("channel"), 30) === "sms" ? "sms" : "email",
      ipAddress: requestHeaders.get("x-qoc-ip"),
      userAgent: requestHeaders.get("x-qoc-user-agent")
    });
    return NextResponse.redirect(publicUrl(`/verify-recovery-code?notice=${encodeURIComponent(result.message)}`, request));
  } catch (error) {
    return handleApiError(error, {
      scope: "password_recovery.request",
      action: "api_failure",
      entityType: "password_recovery",
      fallbackMessage: "Password recovery request failed."
    });
  }
}
