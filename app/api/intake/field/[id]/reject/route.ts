import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { validateApplication } from "@/services/validation/applicationValidationService";
import { withApi } from "@/services/monitoring/errorService";

export const POST = withApi({ scope: "intake.field.reject", entityType: "extractedField", fallbackMessage: "Could not reject field." }, async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireRole(["applicant"]);
  const { id } = await params;
  const field = await prisma.extractedField.update({
    where: { id },
    data: { status: "rejected", applicantConfirmed: true }
  });
  await validateApplication(field.applicationId, user.id);
  await logAction(user.id, "extracted_field_rejected", "extracted_field", field.id);
  return NextResponse.json({ field });
});
