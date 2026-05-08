import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeEmail, sanitizeText } from "@/lib/security";
import { handleApiError } from "@/services/monitoring/errorService";
import { SMS_CARRIERS } from "@/services/notifications/smsGateway";

const VALID_CARRIERS = new Set(SMS_CARRIERS.map((c) => c.value));

function digitsOnly(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["applicant"]);
    const body = await request.json().catch(() => ({}));
    const profile = await prisma.applicantProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return NextResponse.json({ error: "Applicant profile not found." }, { status: 404 });

    const updates: Record<string, unknown> = {};
    const userUpdates: Record<string, unknown> = {};
    const auditDetails: Record<string, unknown> = {};

    if (body.email !== undefined) {
      const newEmail = sanitizeEmail(body.email);
      if (!newEmail) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
      // Check for collision with another user
      const existing = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
      if (existing && existing.id !== user.id) {
        return NextResponse.json({ error: "An account already exists with that email." }, { status: 409 });
      }
      userUpdates.email = newEmail;
      updates.emailIsTemporary = false;
      auditDetails.emailChanged = true;
    }

    if (body.phone !== undefined) {
      const digits = digitsOnly(String(body.phone));
      const last10 = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
      if (last10.length !== 10) return NextResponse.json({ error: "Enter a valid 10-digit US mobile number." }, { status: 400 });
      updates.phone = last10;
      updates.phoneIsTemporary = false;
      auditDetails.phoneChanged = true;
    }

    if (body.phoneCarrier !== undefined) {
      const carrier = sanitizeText(body.phoneCarrier, 50);
      if (carrier && !VALID_CARRIERS.has(carrier as never)) {
        return NextResponse.json({ error: "Unknown carrier." }, { status: 400 });
      }
      updates.phoneCarrier = carrier || null;
      auditDetails.carrierChanged = true;
    }

    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: userUpdates });
    }
    if (Object.keys(updates).length > 0) {
      await prisma.applicantProfile.update({ where: { id: profile.id }, data: updates });
    }

    await logAction(user.id, "applicant.contact_info_confirmed", "applicantProfile", profile.id, auditDetails as never);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, {
      scope: "applicant.profile.confirmContact",
      action: "post",
      entityType: "applicantProfile",
      fallbackMessage: "Could not update contact info."
    });
  }
}
