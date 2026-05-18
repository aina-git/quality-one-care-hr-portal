import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { withApi, AppError } from "@/services/monitoring/errorService";
import { recordInterviewOutcome } from "@/services/interview/interviewOutcomeService";
import type { InterviewOutcome } from "@/services/interview/interviewOutcomeService";

const ALLOWED: InterviewOutcome[] = ["passed", "failed", "no_show", "rescheduled"];

export const POST = withApi(
  { scope: "hr.interview.outcome", entityType: "interview", fallbackMessage: "Could not record interview outcome." },
  async (request: Request, { params }: { params: Promise<{ id: string; interviewId: string }> }) => {
    const user = await requireRole(["hr", "super_admin_hr"]);
    const { id, interviewId } = await params;
    const body = await request.json().catch(() => ({}));
    const outcome = String(body.outcome ?? "") as InterviewOutcome;
    const hrNote = String(body.hrNote ?? "");
    if (!ALLOWED.includes(outcome)) {
      throw new AppError("Choose a valid outcome (passed, failed, no_show, rescheduled).", { statusCode: 400, code: "VALIDATION" });
    }
    const updated = await recordInterviewOutcome({
      applicationId: id,
      interviewId,
      outcome,
      hrNote,
      userId: user.id,
      userRole: user.role as "hr" | "super_admin_hr" | "super_admin_hr"
    });
    return NextResponse.json({ ok: true, interview: updated });
  }
);
