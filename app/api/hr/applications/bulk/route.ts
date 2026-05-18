import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { sanitizeText } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { createApplicantMessageWithEmail } from "@/services/notifications/emailService";
import { renderMessageTemplate } from "@/services/notifications/messageTemplateService";
import { resolveApplicationAlertsByCategory } from "@/services/alerts/systemAlertService";
import { handleApiError } from "@/services/monitoring/errorService";
import { startHrReviewWorkflow } from "@/services/workflow/hrReviewQueueService";

export async function POST(request: Request) {
  const user = await requireRole(["hr", "super_admin_hr"]);

  try {
    const body = await request.json().catch(() => ({}));
    const action = sanitizeText(body.action, 80);
    const ids = Array.isArray(body.applicationIds) ? body.applicationIds.map((value: unknown) => sanitizeText(value, 64)).filter(Boolean) : [];
    const note = sanitizeText(body.note, 1000);

    if (!ids.length) {
      return NextResponse.json({ error: "Select at least one application." }, { status: 400 });
    }

    const applications = await prisma.application.findMany({
      where: {
        id: { in: ids },
        status: { not: "draft" }
      },
      include: {
        applicantProfile: {
          include: {
            user: true
          }
        }
      }
    });

    if (!applications.length) {
      return NextResponse.json({ error: "No eligible applications were found." }, { status: 404 });
    }

    if (action === "send_reminder") {
      const template = await renderMessageTemplate("bulk_application_reminder", {
        note: note || "Please review your application and complete any remaining steps."
      });
      for (const application of applications) {
        await createApplicantMessageWithEmail({
          applicationId: application.id,
          senderId: user.id,
          senderRole: user.role as "hr" | "super_admin_hr",
          templateKey: template.templateKey,
          subject: template.subject,
          body: template.body,
          userIdForAudit: user.id
        });
      }
      await logAction(user.id, "bulk_reminder_sent", "application_bulk", null, {
        applicationIds: applications.map((application) => application.id),
        count: applications.length
      });
      return NextResponse.json({ ok: true, updated: applications.length });
    }

    if (action === "mark_reviewed") {
      let updatedCount = 0;
      for (const application of applications) {
        if (!["submitted", "hr_review_pending"].includes(application.status)) continue;
        await startHrReviewWorkflow(application.id, user.id);
        await resolveApplicationAlertsByCategory("pending_review", application.id, user.id);
        updatedCount += 1;
      }

      await logAction(user.id, "bulk_mark_reviewed", "application_bulk", null, {
        applicationIds: applications.map((application) => application.id),
        count: updatedCount
      });
      return NextResponse.json({ ok: true, updated: updatedCount });
    }

    return NextResponse.json({ error: "Choose a valid bulk action." }, { status: 400 });
  } catch (error) {
    return handleApiError(error, {
      scope: "hr.bulk",
      action: "bulk_action_failed",
      userId: user.id,
      entityType: "application_bulk",
      fallbackMessage: "Bulk action could not be completed."
    });
  }
}
