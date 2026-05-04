import type { HRDecisionAction } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createHRDecision, decisionStatusMap } from "@/services/workflow/decisionService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "admin"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "") as HRDecisionAction;
  const note = String(body.note ?? "");

  if (!Object.keys(decisionStatusMap).includes(action)) {
    return NextResponse.json({ error: "Choose a valid HR action." }, { status: 400 });
  }

  try {
    const decision = await createHRDecision({ applicationId: id, action, note, userId: user.id, userRole: user.role as "hr" | "admin" });
    return NextResponse.json({ decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Decision could not be saved.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
