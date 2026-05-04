import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/services/monitoring/errorService";

const roles = ["applicant", "hr", "admin", "super_admin_hr", "don_approver", "executive_view_only", "scheduler_limited"];

export const PATCH = withApi({ scope: "admin.users", entityType: "user", fallbackMessage: "Could not update user." }, async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole(["admin", "super_admin_hr"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const role = body.role === undefined ? undefined : String(body.role) as Role;
  const isActive = body.isActive === undefined ? undefined : Boolean(body.isActive);

  if (role !== undefined && !roles.includes(role)) {
    return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (existing.id === actor.id && isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      role,
      isActive
    }
  });
  if (role && role !== existing.role) {
    await logAction(actor.id, "user_role_changed", "user", id, { from: existing.role, to: role });
    await logAction(actor.id, "role_updated", "user", id, { role });
  }
  if (isActive !== undefined && isActive !== existing.isActive) {
    await logAction(actor.id, isActive ? "user_activated" : "user_deactivated", "user", id);
  }
  return NextResponse.json({ user: { id: updated.id } });
});
