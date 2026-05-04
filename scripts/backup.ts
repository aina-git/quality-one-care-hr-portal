import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups", stamp);
  await fs.mkdir(backupDir, { recursive: true });

  const [users, applications, auditLogs] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true }
    }),
    prisma.application.findMany({
      include: {
        applicantProfile: { include: { user: { select: { id: true, email: true, name: true } } } },
        interviewRecords: true,
        onboardingChecklist: { include: { items: true } },
        licenseAlerts: true
      }
    }),
    prisma.auditLog.findMany({
      include: { user: { select: { id: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  await Promise.all([
    fs.writeFile(path.join(backupDir, "users.json"), JSON.stringify(users, null, 2)),
    fs.writeFile(path.join(backupDir, "applications.json"), JSON.stringify(applications, null, 2)),
    fs.writeFile(path.join(backupDir, "audit-logs.json"), JSON.stringify(auditLogs, null, 2))
  ]);

  console.log(`Backup completed in ${backupDir}`);
}

main()
  .catch((error) => {
    console.error("Backup failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
