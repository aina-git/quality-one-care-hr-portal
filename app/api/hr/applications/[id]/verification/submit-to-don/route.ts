import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { getVerificationChecklist, refreshChecklistStatus, summarizeChecklist } from "@/services/verification/verificationService";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "super_admin_hr"]);
  const { id } = await params;
  const checklist = await getVerificationChecklist(id);
  if (!checklist) return NextResponse.json({ error: "Verification checklist not found." }, { status: 404 });
  const summary = summarizeChecklist(checklist);
  if (!summary.readyForDon) {
    return NextResponse.json({
      error: `Checklist is not ready. Resolve ${summary.criticalBlockers.length} critical blocker(s) and ${summary.missingItems.length} missing required item(s).`
    }, { status: 400 });
  }
  const updated = await refreshChecklistStatus(checklist.id, user.id);
  await logAction(user.id, "submitted_to_don", "final_verification", checklist.id, { applicationId: id });
  return NextResponse.json({ checklist: updated });
}
