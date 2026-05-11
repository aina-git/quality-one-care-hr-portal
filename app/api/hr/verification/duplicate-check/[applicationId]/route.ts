import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { checkForDuplicates } from "@/services/verification/duplicateDetectionService";

export async function GET(_req: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  await requireRole(["hr", "admin", "super_admin_hr", "don_approver"]);
  const { applicationId } = await params;
  const analysis = await checkForDuplicates(applicationId);
  return NextResponse.json(analysis);
}
