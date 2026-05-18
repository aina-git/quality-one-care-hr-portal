import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "super_admin_hr"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const note = sanitizeText(body.note, 1200);
  if (!note) return NextResponse.json({ error: "HR override requires a note." }, { status: 400 });
  const field = await prisma.extractedField.update({
    where: { id },
    data: {
      status: "accepted",
      applicantConfirmed: true,
      hrOverrideNote: note,
      hrOverrideByUserId: user.id,
      hrOverrideAt: new Date()
    }
  });
  await logAction(user.id, "hr_override_applied", "extracted_field", field.id, {
    applicationId: field.applicationId,
    fieldKey: field.fieldKey,
    note
  });
  return NextResponse.json({ field });
}
