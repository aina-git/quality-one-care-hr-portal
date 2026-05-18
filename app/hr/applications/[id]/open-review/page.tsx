import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { startHrReviewWorkflow } from "@/services/workflow/hrReviewQueueService";

export default async function OpenHrReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "super_admin_hr"]);
  const { id } = await params;
  await startHrReviewWorkflow(id, user.id);
  redirect(`/hr/applications/${id}/review`);
}
