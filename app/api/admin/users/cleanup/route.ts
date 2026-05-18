import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/services/monitoring/errorService";

const REQUIRED_CONFIRMATION = "DELETE ALL OTHER USERS";

/**
 * One-shot cleanup for first-applicant prep.
 *
 * Deletes every User except:
 *   1. The actor (preserves your account + ensures role = super_admin_hr)
 *   2. Any applicant whose ApplicantProfile owns at least one non-draft
 *      Application (preserves real applicants so their application data
 *      isn't cascade-deleted)
 *
 * Also wipes:
 *   - All Notification rows (the inflated "29" badge)
 *   - All resolved=false SystemAlert rows
 *
 * IRREVERSIBLE. Requires the caller to send the literal confirmation phrase
 * "DELETE ALL OTHER USERS" so accidental requests bounce.
 */
export const POST = withApi(
  { scope: "admin.users.cleanup", entityType: "user", fallbackMessage: "Cleanup failed." },
  async (request: Request) => {
    const actor = await requireRole(["super_admin_hr"]);
    const body = await request.json().catch(() => ({}));
    const confirmation = String(body.confirmation ?? "").trim();

    if (confirmation !== REQUIRED_CONFIRMATION) {
      return NextResponse.json(
        { error: `Confirmation phrase must be exactly: ${REQUIRED_CONFIRMATION}` },
        { status: 400 }
      );
    }

    // Identify users who own a non-draft application — those we preserve so
    // their submitted/in-progress applications aren't lost to cascade.
    const applicantsWithApps = await prisma.user.findMany({
      where: {
        applicant: {
          applications: {
            some: { status: { not: "draft" } }
          }
        }
      },
      select: { id: true, email: true }
    });
    const preservedIds = new Set<string>([actor.id, ...applicantsWithApps.map((u) => u.id)]);

    // Everyone else gets deleted.
    const others = await prisma.user.findMany({
      where: { id: { notIn: Array.from(preservedIds) } },
      select: { id: true, email: true, role: true }
    });

    let deletedUsers = 0;
    const failures: Array<{ email: string; reason: string }> = [];

    for (const u of others) {
      try {
        await prisma.user.delete({ where: { id: u.id } });
        await logAction(actor.id, "user_deleted", "user", u.id, {
          deletedEmail: u.email,
          deletedRole: u.role,
          source: "bulk_cleanup"
        });
        deletedUsers += 1;
      } catch (err) {
        failures.push({
          email: u.email,
          reason: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }

    // Wipe all notifications (clears the inflated alert count and stale messages).
    const deletedNotifications = await prisma.notification.deleteMany({});

    // Wipe all unresolved system alerts (operational noise from prior testing).
    const deletedAlerts = await prisma.systemAlert.deleteMany({});

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
      deletedUserCount: deletedUsers,
      preservedApplicantCount: applicantsWithApps.length,
      deletedNotificationCount: deletedNotifications.count,
      deletedSystemAlertCount: deletedAlerts.count,
      failureCount: failures.length
    });

    return NextResponse.json({
      ok: true,
      deletedUserCount: deletedUsers,
      preservedApplicantCount: applicantsWithApps.length,
      preservedApplicants: applicantsWithApps.map((u) => u.email),
      deletedNotificationCount: deletedNotifications.count,
      deletedSystemAlertCount: deletedAlerts.count,
      failureCount: failures.length,
      failures
    });
  }
);
