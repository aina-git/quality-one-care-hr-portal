import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security";
import { validateApplication } from "@/services/validation/applicationValidationService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["applicant"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const note = sanitizeText(body.note, 1200);
  const sourceDocumentId = sanitizeText(body.sourceDocumentId, 120) || null;
  const action = sanitizeText(body.action, 80) === "hr_review_requested" ? "hr_review_requested" : "applicant_claims_present";
  if (!note) return NextResponse.json({ error: "Add a note explaining where this information appears." }, { status: 400 });

  const issue = await prisma.validationIssue.findUnique({
    where: { id },
    include: { application: { include: { applicantProfile: true } } }
  });
  if (!issue || issue.application.applicantProfile.userId !== user.id) {
    return NextResponse.json({ error: "Issue was not found." }, { status: 404 });
  }
  const fieldKey = issue.fieldKey ?? issue.section;
  const existing = await prisma.applicantFieldAssertion.findFirst({
    where: { applicationId: issue.applicationId, fieldKey, issueType: action, sourceDocumentId }
  });
  const assertion = existing
    ? await prisma.applicantFieldAssertion.update({
      where: { id: existing.id },
      data: {
        note,
        sourceDocumentId,
        status: "hr_review_requested",
        createdById: user.id
      }
    })
    : await prisma.applicantFieldAssertion.create({
      data: {
      applicationId: issue.applicationId,
      fieldKey,
      issueType: action,
      note,
      sourceDocumentId,
      status: "hr_review_requested",
      createdById: user.id
      }
    });
  await logAction(user.id, action === "applicant_claims_present" ? "applicant_claimed_field_present" : "field_sent_to_hr_review", "validation_issue", issue.id, {
    applicationId: issue.applicationId,
    fieldKey,
    sourceDocumentId,
    note
  });
  await validateApplication(issue.applicationId, user.id);
  return NextResponse.json({ assertion });
}
