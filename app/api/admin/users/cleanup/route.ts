import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/services/monitoring/errorService";

const REQUIRED_CONFIRMATION = "DELETE ALL OTHER USERS";

/**
 * One-shot cleanup: deletes every User except the actor and ensures the actor
 * has the super_admin_hr role. Cascades through ApplicantProfile to
 * Applications and downstream relations via existing onDelete: Cascade FKs.
 *
 * IRREVERSIBLE. Requires the caller to send confirmation: "DELETE ALL OTHER USERS"
 * in the body so it cannot be triggered by an accidental request.
 */
export const POST = withApi(
  { scope: "admin.users.cleanup", entityType: "user", fallbackMessage: "Cleanup failed." },
  async (request: Request) => {
    const actor = await requireRole(["admin", "super_admin_hr"]);
    const body = await request.json().catch(() => ({}));
    const confirmation = String(body.confirmation ?? "").trim();

    if (confirmation !== REQUIRED_CONFIRMATION) {
      return NextResponse.json(
        { error: `Confirmation phrase must be exactly: ${REQUIRED_CONFIRMATION}` },
        { status: 400 }
      );
    }

    // Identify everyone except the actor.
    const others = await prisma.user.findMany({
      where: { id: { not: actor.id } },
      select: { id: true, email: true, role: true }
    });

    let deleted = 0;
    const failures: Array<{ email: string; reason: string }> = [];

    for (const u of others) {
      try {
        await prisma.user.delete({ where: { id: u.id } });
        await logAction(actor.id, "user_deleted", "user", u.id, {
          deletedEmail: u.email,
          deletedRole: u.role,
          source: "bulk_cleanup"
        });
        deleted += 1;
      } catch (err) {
        failures.push({
          email: u.email,
          reason: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }

    // Ensure the actor is super_admin_hr after the wipe so they retain control.
    if (actor.role !== "super_admin_hr") {
      await prisma.user.update({
        where: { id: actor.id },
        data: { role: "super_admin_hr", isActive: true }
      });
      await logAction(actor.id, "user_role_changed", "user", actor.id, {
        from: actor.role,
        to: "super_admin_hr",
        source: "bulk_cleanup"
      });
    }

    await logAction(actor.id, "admin_users_bulk_cleanup", "user", null, {
      deletedCount: deleted,
      failureCount: failures.length
    });

    return NextResponse.json({
      ok: true,
      deletedCount: deleted,
      failureCount: failures.length,
      failures
    });
  }
);
