import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { analyzeEmploymentGaps } from "@/services/verification/employmentGapService";

export async function GET(_req: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  await requireRole(["hr", "admin", "super_admin_hr", "don_approver", "executive_view_only"]);
  const { applicationId } = await params;
  const analysis = await analyzeEmploymentGaps(applicationId);
  return NextResponse.json(analysis);
}
