import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

const IDENTITY_DOC_TYPES = ["license", "government_id", "state_id", "drivers_license", "passport", "id_card", "application_form"];

export async function resolveIdentityFromOtherDocuments(applicationId: string, userId: string) {
  const profile = await prisma.applicantProfile.findFirst({
    where: { applications: { some: { id: applicationId } } },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  if (!profile) return { resolved: false, fieldsRecovered: 0 };

  const hasName = !!(profile.user.name?.trim());
  const hasAddress = !!(profile.address?.trim());
  const hasCity = !!(profile.city?.trim());
  const hasState = !!(profile.state?.trim());

  if (hasName && hasAddress && hasCity && hasState) {
    return { resolved: true, fieldsRecovered: 0, message: "All identity fields already present" };
  }

  const idDocuments = await prisma.uploadedDocument.findMany({
    where: {
      applicationId,
      processingStatus: "completed",
      detectedDocumentType: { in: IDENTITY_DOC_TYPES }
    },
    include: {
      extractions: {
        include: {
          fields: {
            where: {
              fieldKey: { in: ["firstName", "lastName", "name", "address", "city", "state", "zipCode"] },
              confidence: { gte: 0.6 }
            },
            orderBy: { confidence: "desc" }
          }
        }
      }
    },
    orderBy: { extractionConfidence: "desc" }
  });

  let fieldsRecovered = 0;
  const updates: Record<string, string> = {};
  const userUpdates: Record<string, string> = {};

  for (const doc of idDocuments) {
    for (const extraction of doc.extractions) {
      for (const field of extraction.fields) {
        const value = field.applicantCorrectedValue || field.extractedValue;
        if (!value?.trim()) continue;

        if (!hasName && (field.fieldKey === "firstName" || field.fieldKey === "lastName" || field.fieldKey === "name")) {
          if (field.fieldKey === "name" && !userUpdates.name) {
            userUpdates.name = value.trim();
            fieldsRecovered++;
          }
          if (field.fieldKey === "firstName" && !userUpdates.firstName) {
            userUpdates.firstName = value.trim();
            fieldsRecovered++;
          }
          if (field.fieldKey === "lastName" && !userUpdates.lastName) {
            userUpdates.lastName = value.trim();
            fieldsRecovered++;
          }
        }

        if (!hasAddress && field.fieldKey === "address" && !updates.address) {
          updates.address = value.trim();
          fieldsRecovered++;
        }
        if (!hasCity && field.fieldKey === "city" && !updates.city) {
          updates.city = value.trim();
          fieldsRecovered++;
        }
        if (!hasState && field.fieldKey === "state" && !updates.state) {
          updates.state = value.trim();
          fieldsRecovered++;
        }
        if (field.fieldKey === "zipCode" && !profile.zip && !updates.zip) {
          updates.zip = value.trim();
          fieldsRecovered++;
        }
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.applicantProfile.update({
      where: { id: profile.id },
      data: updates
    });
  }

  if (!hasName) {
    const fullName = userUpdates.name
      || (userUpdates.firstName && userUpdates.lastName
        ? `${userUpdates.firstName} ${userUpdates.lastName}`
        : userUpdates.firstName || userUpdates.lastName || "");
    if (fullName) {
      await prisma.user.update({
        where: { id: profile.user.id },
        data: { name: fullName }
      });
    }
  }

  if (fieldsRecovered > 0) {
    await logAction(userId, "identity_fallback_resolved", "application", applicationId, {
      fieldsRecovered,
      profileUpdates: Object.keys(updates),
      nameRecovered: !hasName && !!(userUpdates.name || userUpdates.firstName)
    });
  }

  return {
    resolved: fieldsRecovered > 0,
    fieldsRecovered,
    message: fieldsRecovered > 0
      ? `Recovered ${fieldsRecovered} identity field${fieldsRecovered > 1 ? "s" : ""} from ID/license documents`
      : "No additional identity fields found in uploaded documents"
  };
}
