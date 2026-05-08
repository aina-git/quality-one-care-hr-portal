import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { AppError, handleApiError } from "@/services/monitoring/errorService";
import { readCookieValue, sanitizeEmail, sanitizeText } from "@/lib/security";
import { storeApplicantIdentityPhoto, validateIdentityPhoto } from "@/services/identityPhotoService";
import { publicUrl } from "@/lib/publicUrl";
import {
  deliverApplicantLoginCredentials,
  generateTemporaryPassword,
  nextSyntheticEmailIfTaken
} from "@/services/notifications/credentialDeliveryService";
import { SMS_CARRIERS } from "@/services/notifications/smsGateway";

const VALID_CARRIERS = new Set(SMS_CARRIERS.map((c) => c.value));

function digitsOnly(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const csrfToken = sanitizeText(body.get("csrfToken"), 200);
    const csrfCookie = readCookieValue(request.headers.get("cookie"), "qoc_csrf");
    if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
      throw new AppError("Security check failed. Refresh the page and try again.", { statusCode: 403, code: "CSRF_INVALID" });
    }

    const contactMode = sanitizeText(body.get("contactMode"), 20) === "phone" ? "phone" : "email";
    const name = sanitizeText(body.get("name"), 120);
    const photoConsent = sanitizeText(body.get("photoConsent"), 20);
    const photoSourceValue = sanitizeText(body.get("photoSource"), 20);
    const photoSource = photoSourceValue === "camera" ? "camera" : "upload";
    const photo = body.get("identityPhoto");

    if (photoConsent !== "yes") {
      throw new AppError("Photo consent is required before account creation.", { statusCode: 400, code: "PHOTO_CONSENT_REQUIRED" });
    }
    if (!(photo instanceof File)) {
      throw new AppError("Identity photo is required before account creation.", { statusCode: 400, code: "PHOTO_REQUIRED" });
    }
    const buffer = Buffer.from(await photo.arrayBuffer());
    validateIdentityPhoto({ buffer, mimeType: photo.type, size: photo.size });

    let userEmail: string | null = null;
    let password: string;
    let phoneRaw: string | null = null;
    let phoneCarrier: string | null = null;
    let emailIsTemporary = false;
    let credentialDeliveryNeeded = false;

    if (contactMode === "phone") {
      const phoneInput = sanitizeText(body.get("phone"), 50);
      const carrier = sanitizeText(body.get("phoneCarrier"), 50);
      const digits = digitsOnly(phoneInput);
      const last10 = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
      if (last10.length !== 10) {
        return NextResponse.redirect(publicUrl("/register?error=invalid", request));
      }
      if (!VALID_CARRIERS.has(carrier as never)) {
        return NextResponse.redirect(publicUrl("/register?error=invalid", request));
      }
      phoneRaw = last10;
      phoneCarrier = carrier;
      // Synthesize a unique email so the User table's unique constraint is satisfied;
      // applicant can update to a real one later from the dashboard.
      userEmail = await nextSyntheticEmailIfTaken(last10);
      emailIsTemporary = true;
      password = generateTemporaryPassword();
      credentialDeliveryNeeded = true;
    } else {
      const email = sanitizeEmail(body.get("email"));
      const pwd = sanitizeText(body.get("password"), 256);
      if (!email || !pwd || pwd.length < 8) {
        return NextResponse.redirect(publicUrl("/register?error=invalid", request));
      }
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.redirect(publicUrl("/register?error=exists", request));
      }
      userEmail = email;
      password = pwd;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        name: name || null,
        passwordHash,
        role: "applicant",
        applicant: {
          create: {
            phone: phoneRaw,
            phoneCarrier,
            emailIsTemporary,
            phoneIsTemporary: false
          }
        }
      },
      include: { applicant: true }
    });
    if (!user.applicant) throw new AppError("Applicant profile could not be created.", { statusCode: 500, code: "PROFILE_MISSING" });

    await storeApplicantIdentityPhoto({
      applicantProfileId: user.applicant.id,
      userId: user.id,
      fileName: photo.name || "profile-photo",
      mimeType: photo.type,
      size: photo.size,
      buffer,
      source: photoSource
    });

    await logAction(user.id, "auth.register", "user", user.id, { role: "applicant", contactMode });

    if (credentialDeliveryNeeded) {
      const firstName = (name ?? "").trim().split(/\s+/)[0] || null;
      await deliverApplicantLoginCredentials({
        userId: user.id,
        toEmail: null, // synthetic email — don't send to it
        phone: phoneRaw,
        phoneCarrier,
        smsEmailOverride: null,
        temporaryPassword: password,
        applicantFirstName: firstName
      });
    }

    await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });

    return NextResponse.redirect(publicUrl("/applicant/start", request));
  } catch (error) {
    return handleApiError(error, {
      scope: "auth.register",
      action: "api_failure",
      entityType: "auth",
      fallbackMessage: "Registration failed."
    });
  }
}
