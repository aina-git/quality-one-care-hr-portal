import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { mapConfirmedField } from "@/services/intake/mappingService";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { withApi } from "@/services/monitoring/errorService";

export const POST = withApi({ scope: "intake.field.correct", entityType: "extractedField", fallbackMessage: "Could not save correction." }, async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(["applicant"]);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const value = String(body.value ?? "").trim();
  if (!value) return NextResponse.json({ error: "Enter a corrected value." }, { status: 400 });

  const field = await prisma.extractedField.update({
    where: { id },
    data: { status: "corrected", applicantConfirmed: true, applicantCorrectedValue: value, correctedAt: new Date(), correctedByUserId: user.id }
  });
  await mapConfirmedField(field.id);
  await validateApplication(field.applicationId, user.id);
  await logAction(user.id, "extracted_field_corrected", "extracted_field", field.id);
  await logAction(user.id, "applicant_field_corrected", "extracted_field", field.id, {
    fieldKey: field.fieldKey,
    applicationId: field.applicationId
  });
  return NextResponse.json({ field });
});
