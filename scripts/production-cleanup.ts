/**
 * Production cleanup script — run ONCE to prepare the database for real use.
 *
 * Actions:
 * 1. Deletes ALL applicant users and their cascaded data (profiles, applications, documents, etc.)
 * 2. Deletes ALL staff users EXCEPT aaina@qualityonecare.com
 * 3. Upserts aaina@qualityonecare.com as admin (HR Manager) with a secure temporary password
 * 4. Clears orphaned workflow data (tasks, notifications, calendar events, communications)
 * 5. Clears audit logs from demo period
 *
 * Run: npx tsx scripts/production-cleanup.ts
 *
 * SAFETY: This script is destructive. It requires CONFIRM_CLEANUP=yes env var.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const HR_MANAGER_EMAIL = "aaina@qualityonecare.com";
const HR_MANAGER_NAME = "Aaina";
const TEMP_PASSWORD = "QOC2026!hr";

async function main() {
  if (process.env.CONFIRM_CLEANUP !== "yes") {
    console.error("SAFETY: Set CONFIRM_CLEANUP=yes to run this script.");
    console.error("  CONFIRM_CLEANUP=yes npx tsx scripts/production-cleanup.ts");
    process.exit(1);
  }

  console.log("=== Production Cleanup ===");
  console.log(`Target: Keep only ${HR_MANAGER_EMAIL}`);
  console.log("");

  // 1. Delete all applicant users (cascade removes profiles, applications, documents, etc.)
  const applicants = await prisma.user.findMany({ where: { role: "applicant" } });
  if (applicants.length > 0) {
    for (const u of applicants) {
      await prisma.user.delete({ where: { id: u.id } });
    }
    console.log(`Deleted ${applicants.length} applicant user(s) and all cascaded data.`);
  } else {
    console.log("No applicant users to delete.");
  }

  // 2. Delete all staff users except the HR Manager
  const staffToDelete = await prisma.user.findMany({
    where: { email: { not: HR_MANAGER_EMAIL } },
  });
  if (staffToDelete.length > 0) {
    for (const u of staffToDelete) {
      await prisma.user.delete({ where: { id: u.id } });
    }
    console.log(`Deleted ${staffToDelete.length} staff user(s).`);
  } else {
    console.log("No extra staff users to delete.");
  }

  // 3. Upsert the HR Manager
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: HR_MANAGER_EMAIL },
    update: { name: HR_MANAGER_NAME, role: "admin", isActive: true, passwordHash },
    create: { email: HR_MANAGER_EMAIL, name: HR_MANAGER_NAME, role: "admin", passwordHash },
  });
  console.log(`Upserted ${HR_MANAGER_EMAIL} as admin (HR Manager).`);
  console.log(`  Temporary password: ${TEMP_PASSWORD}`);
  console.log(`  (Change this immediately after first login)`);

  // 4. Clear orphaned workflow data
  const [tasks, notifications, events, comms, reminders, alerts, emailQ, smsQ, whatsappQ] = await Promise.all([
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
  console.log(`Cleared: ${tasks.count} tasks, ${notifications.count} notifications, ${events.count} events, ${comms.count} comm logs, ${reminders.count} reminders, ${alerts.count} alerts, ${emailQ.count} email queue, ${smsQ.count} SMS queue, ${whatsappQ.count} WhatsApp queue.`);

  // 5. Clear audit logs from demo period
  const auditResult = await prisma.auditLog.deleteMany({});
  console.log(`Cleared ${auditResult.count} audit log entries.`);

  // 6. Clear job run history
  const jobRuns = await prisma.jobRun.deleteMany({});
  console.log(`Cleared ${jobRuns.count} job run records.`);

  console.log("");
  console.log("=== Cleanup Complete ===");
  console.log(`Database now contains only: ${HR_MANAGER_EMAIL} (admin)`);
  console.log("You can now create DON, CEO, and Scheduler users from the Admin > Users page.");
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
