import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { isEmailProviderConfigured, sendTestEmail } from "@/services/notifications/emailService";
import { handleApiError } from "@/services/monitoring/errorService";

export async function POST(request: Request) {
  const user = await requireRole(["admin", "super_admin_hr"]);
  try {
    if (!isEmailProviderConfigured()) {
      return NextResponse.json(
        { error: "Email provider is not configured. Set EMAIL_PROVIDER plus its credentials (EMAIL_API_KEY for Resend/SendGrid, or SMTP_HOST + SMTP_USER + SMTP_PASS for SMTP)." },
        { status: 400 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const toEmail = String(body.toEmail ?? "").trim();
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return NextResponse.json({ error: "A valid recipient email address is required." }, { status: 400 });
    }
    const result = await sendTestEmail(toEmail);
    await logAction(user.id, "email_test_send", "email", null, { toEmail, provider: result.provider });
    return NextResponse.json({ ok: true, provider: result.provider, providerMessageId: result.providerMessageId });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.email",
      action: "email_test_send_failed",
      userId: user.id,
      entityType: "email",
      fallbackMessage: "Test email could not be sent."
    });
  }
}
