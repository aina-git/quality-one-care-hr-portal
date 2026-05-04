import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "admin", "super_admin_hr", "don_approver"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = sanitizeText(body.reason, 120);
  const note = sanitizeText(body.note, 1000);
  if (!reason) return NextResponse.json({ error: "Choose a photo review reason." }, { status: 400 });

  const profile = await prisma.applicantProfile.update({
    where: { id },
    data: {
      identityPhotoStatus: reason === "Request new photo" ? "new_photo_requested" : "flagged",
      identityPhotoNotes: note || reason,
      identityPhotoFlaggedAt: new Date(),
      identityPhotoFlaggedById: user.id
    }
  });
  await logAction(user.id, "photo_updated", "applicant_profile", id, {
    reason,
    note,
    status: profile.identityPhotoStatus
  });
  await logAction(user.id, reason === "Request new photo" ? "applicant_reupload_requested" : "photo_quality_flagged", "applicant_profile", id, {
    reason,
    note,
    status: profile.identityPhotoStatus
  });
  return NextResponse.json({ profile });
}
