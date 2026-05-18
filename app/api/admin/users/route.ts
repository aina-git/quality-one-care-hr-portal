import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sanitizeEmail, sanitizeText } from "@/lib/security";

const roles = ["applicant", "hr", "super_admin_hr", "don_approver", "executive_view_only", "scheduler_limited"];

export async function POST(request: Request) {
  const actor = await requireRole(["super_admin_hr"]);
  const body = await request.json().catch(() => ({}));
  const email = sanitizeEmail(body.email);
  const password = sanitizeText(body.password, 256);
  const name = sanitizeText(body.name, 200) || null;
  const role = String(body.role ?? "hr") as Role;

  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "Email and an 8+ character temporary password are required." }, { status: 400 });
  }
  if (!roles.includes(role)) {
    return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
        applicant: role === "applicant" ? { create: {} } : undefined
      }
    });
    await logAction(actor.id, "role_created", "user", user.id, { role });
    await logAction(actor.id, "user_created", "user", user.id, { role });
    return NextResponse.json({ user: { id: user.id } });
  } catch {
    return NextResponse.json({ error: "User could not be created. The email may already exist." }, { status: 400 });
  }
}
