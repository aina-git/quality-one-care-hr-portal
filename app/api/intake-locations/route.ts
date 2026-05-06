import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/services/monitoring/errorService";

// Lists all active intake locations. Any signed-in user (applicant, HR, admin)
// can read this so the application form, file-upload screens, and HR list can
// render a location dropdown.
export async function GET() {
  try {
    await requireAuth();
    const locations = await prisma.intakeLocation.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true }
    });
    return NextResponse.json({ locations });
  } catch (error) {
    return handleApiError(error, {
      scope: "intake-locations",
      action: "list",
      entityType: "intake_location",
      fallbackMessage: "Could not load intake locations."
    });
  }
}
