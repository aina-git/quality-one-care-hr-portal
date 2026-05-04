import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { buildPagination } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getOrCreateApplicantApplication } from "@/services/applicationService";
import { withApi } from "@/services/monitoring/errorService";

export const GET = withApi({ scope: "applicant.messages", entityType: "applicantMessage", fallbackMessage: "Could not load messages." }, async (request: Request) => {
  const user = await requireRole(["applicant"]);
  const { application } = await getOrCreateApplicantApplication(user.id);
  const url = new URL(request.url);
  const { page, pageSize, skip, take } = buildPagination(url.searchParams.get("page"), url.searchParams.get("pageSize"), 10, 25);
  const [total, messages] = await Promise.all([
    prisma.applicantMessage.count({ where: { applicationId: application.id, visibleToApplicant: true } }),
    prisma.applicantMessage.findMany({
      where: { applicationId: application.id, visibleToApplicant: true },
      orderBy: { createdAt: "desc" },
      skip,
      take
    })
  ]);
  return NextResponse.json({ messages, page, pageSize, total });
});
