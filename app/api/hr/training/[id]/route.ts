import type { TrainingRecommendationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withApi, AppError } from "@/services/monitoring/errorService";

const ALLOWED_STATUSES: TrainingRecommendationStatus[] = ["recommended", "assigned", "completed", "waived"];

export const PATCH = withApi(
  { scope: "hr.training", entityType: "trainingRecommendation", fallbackMessage: "Could not update training." },
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireRole(["hr", "super_admin_hr"]);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const status = String(body.status ?? "") as TrainingRecommendationStatus;
    if (!ALLOWED_STATUSES.includes(status)) {
      throw new AppError("Choose a valid status.", { statusCode: 400, code: "VALIDATION" });
    }
    const updated = await prisma.trainingRecommendation.update({
      where: { id },
      data: { status }
    });
    await logAction(user.id, "training_status_changed", "training_recommendation", id, { status });
    return NextResponse.json({ ok: true, recommendation: updated });
  }
);
