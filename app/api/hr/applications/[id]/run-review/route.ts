import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/services/monitoring/errorService";
import { runApplicationReview } from "@/services/review/reviewOrchestrator";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";
import { startHrReviewWorkflow } from "@/services/workflow/hrReviewQueueService";
import { transitionApplication } from "@/services/workflow/controlledWorkflowService";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "admin", "super_admin_hr"]);
  const { id } = await params;

  try {
    await startHrReviewWorkflow(id, user.id).catch(async () =>
      updateApplicationLifecycle({
        applicationId: id,
        userId: user.id,
        action: "hr_review_started",
        patch: { hrReviewStartedAt: new Date(), status: "hr_review_started" }
      })
    );
    await transitionApplication({
      applicationId: id,
      userId: user.id,
      status: "ai_analysis_in_progress",
      action: "ai_analysis_started",
      note: "System-assisted compliance analysis started.",
      createTask: false
    });
    const report = await runApplicationReview(id, user.id);
    return NextResponse.json({ report });
  } catch (error) {
    await transitionApplication({
      applicationId: id,
      userId: user.id,
      status: "ai_issues_found",
      action: "ai_analysis_blocked_or_failed",
      note: error instanceof Error ? error.message : "System-assisted review found issues or failed.",
      taskTitle: "Resolve analysis issue",
      taskDescription: error instanceof Error ? error.message : "System-assisted review found issues or failed.",
      taskPriority: "high"
    }).catch(() => null);
    return handleApiError(error, {
      scope: "review.run",
      action: "review_failure",
      userId: user.id,
      entityType: "application",
      entityId: id,
      fallbackMessage: "Review could not be generated."
    });
  }
}
