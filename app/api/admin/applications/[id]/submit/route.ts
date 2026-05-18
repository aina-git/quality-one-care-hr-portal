import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { ensureHrReviewQueueForApplication } from "@/services/workflow/hrReviewQueueService";
import { transitionApplication } from "@/services/workflow/controlledWorkflowService";
import { updateApplicationLifecycle } from "@/services/applicationLifecycleService";
import { AppError, handleApiError } from "@/services/monitoring/errorService";

// POST /api/admin/applications/[id]/submit
// Admin / HR finalizes a paper-intake application and routes it into the
// HR Review Queue. Bypasses the applicant-facing submit validation since
// HR has already reviewed the documents on intake.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireRole(["super_admin_hr"]);
  const { id: applicationId } = await context.params;

  try {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { applicantProfile: { include: { user: true } } }
    });
    if (!application) {
      throw new AppError("Application not found.", { statusCode: 404 });
    }
    if (application.status !== "draft" && application.status !== "application_uploaded") {
      return NextResponse.json({
        error: `This application is already in the workflow (status: ${application.status}). Use the review screen instead.`
      }, { status: 400 });
    }

    const onBehalfUserId = application.applicantProfile.user.id;

    await transitionApplication({
      applicationId: application.id,
      userId: actor.id,
      status: "intake_review_started",
      action: "intake_review_started",
      note: "Admin submitted paper application for HR review (on behalf of applicant).",
      notifyStaff: false,
      createTask: false
    });

    const updated = await updateApplicationLifecycle({
      applicationId: application.id,
      userId: actor.id,
      action: "application_submitted",
      patch: {
        status: "hr_review_pending",
        applicationSubmittedAt: new Date()
      },
      details: { operationalStatus: "hr_review_pending", source: "admin_intake", onBehalfOf: onBehalfUserId }
    });

    await ensureHrReviewQueueForApplication({
      applicationId: application.id,
      userId: actor.id,
      source: "admin_paper_intake"
    });

    await logAction(actor.id, "application_submitted_on_behalf", "application", application.id, {
      onBehalfOf: onBehalfUserId,
      source: "admin_paper_intake"
    });

    return NextResponse.json({ application: updated });
  } catch (error) {
    return handleApiError(error, {
      scope: "admin.applications.submit",
      action: "api_failure",
      userId: actor.id,
      entityType: "application",
      fallbackMessage: "Could not submit the application for review."
    });
  }
}
