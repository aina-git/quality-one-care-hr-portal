import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { AppError, handleApiError } from "@/services/monitoring/errorService";
import { readCookieValue, sanitizeEmail, sanitizeText } from "@/lib/security";
import { storeApplicantIdentityPhoto, validateIdentityPhoto } from "@/services/identityPhotoService";
import { publicUrl } from "@/lib/publicUrl";

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const email = sanitizeEmail(body.get("email"));
    const name = sanitizeText(body.get("name"), 120);
    const password = sanitizeText(body.get("password"), 256);
    const csrfToken = sanitizeText(body.get("csrfToken"), 200);
    const csrfCookie = readCookieValue(request.headers.get("cookie"), "qoc_csrf");
    const photoConsent = sanitizeText(body.get("photoConsent"), 20);
    const photoSourceValue = sanitizeText(body.get("photoSource"), 20);
    const photoSource = photoSourceValue === "camera" ? "camera" : "upload";
    const photo = body.get("identityPhoto");

    if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
      throw new AppError("Security check failed. Refresh the page and try again.", { statusCode: 403, code: "CSRF_INVALID" });
    }
    if (!email || !password || password.length < 8) {
      return NextResponse.redirect(publicUrl("/register?error=invalid", request));
    }
    if (photoConsent !== "yes") {
      throw new AppError("Photo consent is required before account creation.", { statusCode: 400, code: "PHOTO_CONSENT_REQUIRED" });
    }
    if (!(photo instanceof File)) {
      throw new AppError("Identity photo is required before account creation.", { statusCode: 400, code: "PHOTO_REQUIRED" });
    }
    const buffer = Buffer.from(await photo.arrayBuffer());
    validateIdentityPhoto({ buffer, mimeType: photo.type, size: photo.size });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.redirect(publicUrl("/register?error=exists", request));
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        role: "applicant",
        applicant: {
          create: {}
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

    await logAction(user.id, "auth.register", "user", user.id, { role: "applicant" });
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
