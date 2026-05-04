import { PrismaClient } from "@prisma/client";
import { validateEnvironment } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

validateEnvironment();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
