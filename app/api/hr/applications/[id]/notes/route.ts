import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createHRNote } from "@/services/workflow/decisionService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "super_admin_hr"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const note = String(body.note ?? "");

  try {
    const created = await createHRNote(id, note, user.id);
    return NextResponse.json({ note: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Note could not be saved.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
