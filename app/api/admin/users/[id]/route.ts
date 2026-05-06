import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security";
import { withApi } from "@/services/monitoring/errorService";

const roles = ["applicant", "hr", "admin", "super_admin_hr", "don_approver", "executive_view_only", "scheduler_limited"];

export const DELETE = withApi({ scope: "admin.users", entityType: "user", fallbackMessage: "Could not delete user." }, async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole(["admin", "super_admin_hr"]);
  const { id } = await params;
  if (id === actor.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({
    where: { id },
    include: {
      applicant: { include: { applications: { select: { id: true, status: true } } } }
    }
  });
  if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Refuse to delete users that own meaningful application data unless explicit
  // confirmation is provided. Soft-delete (deactivate) is the safer default.
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  const apps = existing.applicant?.applications ?? [];
  const hasMeaningfulApp = apps.some((a) => a.status !== "draft");
  if (hasMeaningfulApp && !force) {
    return NextResponse.json({
      error: "This user has submitted application data. Add ?force=true to delete anyway, or deactivate instead.",
      applicationCount: apps.length
    }, { status: 409 });
  }

  // Final super-admin guard for deleting another super_admin_hr.
  if (existing.role === "super_admin_hr" && actor.role !== "super_admin_hr") {
    return NextResponse.json({ error: "Only a super admin can delete another super admin." }, { status: 403 });
  }

  // Cascade: applicantProfile cascades on userId delete (per schema), which
  // cascades to applications and their downstream relations. Prisma handles
  // this via the foreign keys we already have.
  await prisma.user.delete({ where: { id } });

  await logAction(actor.id, "user_deleted", "user", id, {
    deletedEmail: existing.email,
    deletedRole: existing.role,
    cascadedApplicationCount: apps.length,
    forced: hasMeaningfulApp
  });
  return NextResponse.json({ ok: true });
});

export const PATCH = withApi({ scope: "admin.users", entityType: "user", fallbackMessage: "Could not update user." }, async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireRole(["admin", "super_admin_hr"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const role = body.role === undefined ? undefined : String(body.role) as Role;
  const isActive = body.isActive === undefined ? undefined : Boolean(body.isActive);
  const newPassword = body.newPassword ? sanitizeText(body.newPassword, 256) : undefined;

  if (role !== undefined && !roles.includes(role)) {
    return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
  }
  if (newPassword && newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (existing.id === actor.id && isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (role !== undefined) updateData.role = role;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (newPassword) updateData.passwordHash = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.user.update({ where: { id }, data: updateData });

  if (role && role !== existing.role) {
    await logAction(actor.id, "user_role_changed", "user", id, { from: existing.role, to: role });
    await logAction(actor.id, "role_updated", "user", id, { role });
  }
  if (isActive !== undefined && isActive !== existing.isActive) {
    await logAction(actor.id, isActive ? "user_activated" : "user_deactivated", "user", id);
  }
  if (newPassword) {
    await logAction(actor.id, "user_password_reset", "user", id);
  }
  return NextResponse.json({ user: { id: updated.id } });
});
