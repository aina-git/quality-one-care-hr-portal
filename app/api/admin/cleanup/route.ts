import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const HR_MANAGER_EMAIL = "aaina@qualityonecare.com";
const HR_MANAGER_NAME = "Aaina";
const TEMP_PASSWORD = "QOC2026!hr";

export async function POST() {
  const actor = await requireRole(["admin", "super_admin_hr"]);

  const applicants = await prisma.user.findMany({ where: { role: "applicant" } });
  for (const u of applicants) {
    await prisma.user.delete({ where: { id: u.id } });
  }

  const staffToDelete = await prisma.user.findMany({
    where: { email: { not: HR_MANAGER_EMAIL }, id: { not: actor.id } },
  });
  for (const u of staffToDelete) {
    await prisma.user.delete({ where: { id: u.id } });
  }

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: HR_MANAGER_EMAIL },
    // Always re-set the password on cleanup so the operator has a known
    // way back in. Without this, a second cleanup left the password at
    // whatever it had been changed to and could lock out the admin.
    update: { name: HR_MANAGER_NAME, role: "admin", isActive: true, passwordHash },
    create: { email: HR_MANAGER_EMAIL, name: HR_MANAGER_NAME, role: "admin", passwordHash },
  });

  await Promise.all([
    prisma.task.deleteMany({}),
    prisma.notification.deleteMany({}),
    prisma.calendarEvent.deleteMany({}),
    prisma.communicationLog.deleteMany({}),
    prisma.reminder.deleteMany({}),
    prisma.systemAlert.deleteMany({}),
    prisma.emailQueue.deleteMany({}),
    prisma.smsQueue.deleteMany({}),
    prisma.whatsAppQueue.deleteMany({}),
  ]);

  await prisma.auditLog.deleteMany({});
  await prisma.jobRun.deleteMany({});

  await logAction(actor.id, "production_cleanup_executed", "system", null, {
    deletedApplicants: applicants.length,
    deletedStaff: staffToDelete.length,
  });

  return NextResponse.json({
    ok: true,
    deletedApplicants: applicants.length,
    deletedStaff: staffToDelete.length,
    preservedUser: HR_MANAGER_EMAIL,
  });
}
