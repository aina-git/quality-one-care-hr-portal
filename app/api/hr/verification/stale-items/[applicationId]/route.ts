import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { findStalePendingItems } from "@/services/verification/stalePendingService";

export async function GET(_req: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  await requireRole(["hr", "super_admin_hr", "don_approver", "executive_view_only"]);
  const { applicationId } = await params;
  const analysis = await findStalePendingItems(applicationId);
  return NextResponse.json(analysis);
}
