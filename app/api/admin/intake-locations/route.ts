import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sanitizeText } from "@/lib/security";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

// HR/admin creates a new intake location (clinic / branch / office) that
// applicants and HR can pick from when submitting or processing applications.
export async function POST(request: Request) {
  try {
    const actor = await requireRole(["super_admin_hr", "hr"]);
    const body = await request.json().catch(() => ({}));
    const name = sanitizeText(body.name, 120);
    if (!name) {
      throw new AppError("Location name is required.", { statusCode: 400, code: "VALIDATION" });
    }
    const city = sanitizeText(body.city, 120) || null;

    const existing = await prisma.intakeLocation.findUnique({ where: { name } });
    if (existing) {
      throw new AppError("A location with that name already exists.", { statusCode: 409, code: "CONFLICT" });
    }

    const location = await prisma.intakeLocation.create({
      data: { name, city, isActive: true }
    });
    await logAction(actor.id, "admin.intake_location_created", "intake_location", location.id, { name, city });
    return NextResponse.json({ location });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.intake-locations",
      action: "create",
      entityType: "intake_location",
      fallbackMessage: "Could not create intake location."
    });
  }
}
