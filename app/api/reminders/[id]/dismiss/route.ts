import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { dismissReminder } from "@/services/operations/reminderService";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;
  try {
    const reminder = await dismissReminder(id, user.id);
    return NextResponse.json({ reminder });
  } catch {
    return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  }
}
