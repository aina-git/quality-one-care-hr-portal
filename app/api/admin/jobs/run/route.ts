import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { sanitizeText } from "@/lib/security";
import { runDueJobs, runJobNow } from "@/services/jobs/jobRunner";
import { handleApiError } from "@/services/monitoring/errorService";

export async function POST(request: Request) {
  const user = await requireRole(["admin"]);

  try {
    const body = await request.json().catch(() => ({}));
    const jobKey = sanitizeText(body.jobKey, 80);
    const result = jobKey ? await runJobNow(jobKey) : await runDueJobs();
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.jobs",
      action: "job_execution_failed",
      userId: user.id,
      entityType: "job",
      fallbackMessage: "Job run could not be started."
    });
  }
}
