import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { startHrReviewWorkflow } from "@/services/workflow/hrReviewQueueService";

export default async function AdminOpenReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["super_admin_hr"]);
  const { id } = await params;
  await startHrReviewWorkflow(id, user.id);
  redirect(`/admin/applications/${id}/review`);
}
