import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { generateLicenseAlerts } from "@/services/license/licenseAlertService";
import { handleApiError } from "@/services/monitoring/errorService";

export async function POST() {
  const user = await requireRole(["hr", "super_admin_hr"]);
  try {
    const alerts = await generateLicenseAlerts(user.id);
    return NextResponse.json({ alerts });
  } catch (error) {
    return handleApiError(error, {
      scope: "license.alerts",
      action: "messaging_failure",
      userId: user.id,
      entityType: "license_alert",
      fallbackMessage: "License alerts could not be generated."
    });
  }
}
