/**
 * Emergency password reset for the Quality One Care HR portal admin user.
 *
 * Usage (from Railway service shell or any environment with DATABASE_URL set):
 *
 *     npx tsx scripts/reset-aaina-password.ts <new-password>
 *
 * Requirements:
 *   - The new password must be 8+ characters.
 *   - DATABASE_URL must point at the production Postgres instance.
 *
 * What it does:
 *   - Finds the user with email aaina@qualityonecare.com
 *   - Hashes the supplied password with bcrypt (12 rounds, same as the app)
 *   - Updates that user's passwordHash field
 *   - Sets isActive = true and role = "admin" defensively
 *   - Prints a confirmation
 *
 * It does NOT touch any other user, application, or document.
 */

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const ADMIN_EMAIL = "aaina@qualityonecare.com";

async function main() {
  const newPassword = process.argv[2];
  if (!newPassword) {
    console.error("Usage: npx tsx scripts/reset-aaina-password.ts <new-password>");
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, role: "admin", isActive: true },
    create: {
      email: ADMIN_EMAIL,
      name: "Aaina",
      role: "admin",
      passwordHash
    }
  });

  console.log(`Reset password for ${user.email} (id: ${user.id}, role: ${user.role}, active: ${user.isActive}).`);
  console.log("You can now log in with the new password.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Password reset failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
