import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "admin", "super_admin_hr"]);
  const { id } = await params;
  const checklist = await prisma.finalVerificationChecklist.findUnique({ where: { applicationId: id } });
  if (!checklist) return NextResponse.json({ error: "Verification checklist not found." }, { status: 404 });
  await prisma.finalVerificationChecklist.update({
    where: { id: checklist.id },
    data: { reviewedByUserId: user.id }
  });
  await logAction(user.id, "verification_manually_reviewed", "final_verification", checklist.id, { applicationId: id });
  return NextResponse.json({ ok: true });
}
