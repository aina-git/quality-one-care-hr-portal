import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { sanitizeEmail, sanitizeText } from "@/lib/security";

// POST /api/admin/applications
// Creates an applicant + profile + application on behalf of someone who
// will not self-register (paper applicants, walk-ins, existing nurses).
// If a user with the given email already exists and is an applicant, we
// reuse them. Otherwise we create a fresh applicant account.
export async function POST(request: Request) {
  const actor = await requireRole(["super_admin_hr"]);
  const body = await request.json().catch(() => ({}));

  const email = sanitizeEmail(body.email);
  const name = sanitizeText(body.name, 200);
  const desiredRole = sanitizeText(body.desiredRole, 200) || "Home Health Care";
  const tempPassword = sanitizeText(body.tempPassword, 256);
  const intakeMode = sanitizeText(body.intakeMode, 80) || "paper_intake";
  const phone = sanitizeText(body.phone, 50);
  const emailIsTemporary = Boolean(body.emailIsTemporary);
  const phoneIsTemporary = Boolean(body.phoneIsTemporary);

  if (!email) {
    return NextResponse.json({ error: "Applicant email is required." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Applicant name is required." }, { status: 400 });
  }
  if (!tempPassword || tempPassword.length < 8) {
    return NextResponse.json({ error: "A temporary password (8+ characters) is required." }, { status: 400 });
  }

  try {
    let user = await prisma.user.findUnique({
      where: { email },
      include: { applicant: { include: { applications: { orderBy: { updatedAt: "desc" }, take: 1 } } } }
    });

    if (user && user.role !== "applicant") {
      return NextResponse.json({ error: "That email already belongs to a non-applicant user." }, { status: 400 });
    }

    if (!user) {
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: "applicant",
          applicant: {
            create: {
              phone: phone || null,
              emailIsTemporary,
              phoneIsTemporary
            }
          }
        },
        include: { applicant: { include: { applications: { orderBy: { updatedAt: "desc" }, take: 1 } } } }
      });
      await logAction(actor.id, "user_created", "user", user.id, { role: "applicant", source: "admin_intake", emailIsTemporary, phoneIsTemporary });
    } else if (user.applicant) {
      // Update temp flags on existing profile if admin re-creates an application
      await prisma.applicantProfile.update({
        where: { id: user.applicant.id },
        data: {
          ...(phone ? { phone } : {}),
          ...(body.emailIsTemporary !== undefined ? { emailIsTemporary } : {}),
          ...(body.phoneIsTemporary !== undefined ? { phoneIsTemporary } : {})
        }
      });
    }

    if (!user.applicant) {
      const profile = await prisma.applicantProfile.create({
        data: {
          userId: user.id,
          phone: phone || null,
          emailIsTemporary,
          phoneIsTemporary
        }
      });
      user = { ...user, applicant: { ...profile, applications: [] } };
    }

    const profileId = user.applicant!.id;
    const existing = user.applicant!.applications[0];
    let application = existing;

    if (!application) {
      application = await prisma.application.create({
        data: {
          applicantProfileId: profileId,
          status: "draft",
          currentStatus: "draft",
          desiredRole,
          intakeMode,
          intakeType: intakeMode,
          createdById: user.id,
          lastActionById: actor.id,
          lastActionAt: new Date()
        }
      });
      await logAction(actor.id, "application_created", "application", application.id, {
        source: "admin_intake",
        intakeMode,
        onBehalfOf: user.id
      });
    }

    return NextResponse.json({
      application: { id: application.id, status: application.status },
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create application.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
