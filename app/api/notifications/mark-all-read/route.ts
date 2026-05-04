import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { markAllNotificationsRead } from "@/services/operations/notificationService";

export async function POST() {
  const user = await requireAuth();
  const result = await markAllNotificationsRead(user.id);
  return NextResponse.json({ updated: result.count });
}
