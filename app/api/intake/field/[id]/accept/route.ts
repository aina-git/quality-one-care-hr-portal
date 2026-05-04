import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { mapConfirmedField } from "@/services/intake/mappingService";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { withApi } from "@/services/monitoring/errorService";

export const POST = withApi({ scope: "intake.field.accept", entityType: "extractedField", fallbackMessage: "Could not accept field." }, async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(["applicant"]);
  const { id } = await params;
  const field = await prisma.extractedField.update({
    where: { id },
    data: { status: "accepted", applicantConfirmed: true }
  });
  await mapConfirmedField(field.id);
  await validateApplication(field.applicationId, user.id);
  await logAction(user.id, "extracted_field_accepted", "extracted_field", field.id);
  return NextResponse.json({ field });
});
