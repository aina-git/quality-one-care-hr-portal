import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function logAction(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: Prisma.InputJsonValue
) {
  let requestHeaders: Awaited<ReturnType<typeof headers>> | null = null;
  try {
    requestHeaders = await headers();
  } catch {
    requestHeaders = null;
  }

  const data = {
    userId,
    action,
    entityType,
    entityId: entityId ?? null,
    ipAddress: requestHeaders?.get("x-qoc-ip") ?? null,
    userAgent: requestHeaders?.get("x-qoc-user-agent") ?? null,
    requestPath: requestHeaders?.get("x-qoc-path") ?? null,
    requestId: requestHeaders?.get("x-qoc-request-id") ?? null,
    details: details ?? undefined
  };

  try {
    return await prisma.auditLog.create({ data });
  } catch (error) {
    if (userId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return prisma.auditLog.create({ data: { ...data, userId: null } });
    }
    throw error;
  }
}
