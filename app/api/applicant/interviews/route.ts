import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { buildPagination } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getOrCreateApplicantApplication } from "@/services/applicationService";

export async function GET(request: Request) {
  const user = await requireRole(["applicant"]);
  const { application } = await getOrCreateApplicantApplication(user.id);
  const url = new URL(request.url);
  const { page, pageSize, skip, take } = buildPagination(url.searchParams.get("page"), url.searchParams.get("pageSize"), 10, 25);
  const [total, interviews] = await Promise.all([
    prisma.interviewRecord.count({ where: { applicationId: application.id } }),
    prisma.interviewRecord.findMany({
      where: { applicationId: application.id },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      skip,
      take
    })
  ]);
  return NextResponse.json({ interviews, page, pageSize, total });
}
