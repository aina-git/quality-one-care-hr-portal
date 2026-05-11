import type { Application, ApplicantProfile, ExtractedField, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

type LoadedApplication = Application & { applicantProfile: ApplicantProfile & { user: User } };

function valueFor(field: ExtractedField) {
  return field.applicantCorrectedValue || field.extractedValue;
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Pure mapping logic — copies a single ExtractedField into the right Prisma
// row on ApplicantProfile / EmploymentHistory / License / Certification /
// Reference. No auth, no confirmation guard. Both manual confirmation and
// auto-map call this.
async function applyFieldToProfile(field: ExtractedField, application: LoadedApplication) {
  const profile = application.applicantProfile;
  const value = valueFor(field);
  if (!value) return;

  if (field.mappedSection === "Personal Info") {
    if (field.fieldKey === "name" || field.fieldKey === "firstName" || field.fieldKey === "lastName") {
      const currentName = profile.user.name || "";
      if (field.fieldKey === "firstName") {
        const lastName = currentName.split(" ").slice(1).join(" ");
        await prisma.user.update({ where: { id: profile.userId }, data: { name: `${value} ${lastName}`.trim() } });
      } else if (field.fieldKey === "lastName") {
        const firstName = currentName.split(" ")[0] || "";
        await prisma.user.update({ where: { id: profile.userId }, data: { name: `${firstName} ${value}`.trim() } });
      } else {
        await prisma.user.update({ where: { id: profile.userId }, data: { name: value } });
      }
    }
    if (field.fieldKey === "phone") {
      await prisma.applicantProfile.update({ where: { id: profile.id }, data: { phone: value } });
    }
    if (field.fieldKey === "dateOfBirth") {
      const date = parseDate(value);
      if (date) await prisma.applicantProfile.update({ where: { id: profile.id }, data: { dateOfBirth: date } });
    }
    if (field.fieldKey === "address" || field.fieldKey === "city" || field.fieldKey === "state" || field.fieldKey === "zipCode") {
      const current = profile.address || "";
      if (field.fieldKey === "address") {
        await prisma.applicantProfile.update({ where: { id: profile.id }, data: { address: value } });
      } else {
        const combined = current ? `${current}, ${value}` : value;
        await prisma.applicantProfile.update({ where: { id: profile.id }, data: { address: combined } });
      }
    }
    return;
  }

  if (field.mappedSection === "Pediatric Experience") {
    const existing = profile.pediatricExperience || "";
    const line = `${field.fieldLabel}: ${value}`;
    // Don't append the same line twice on re-runs.
    if (existing.includes(line)) return;
    await prisma.applicantProfile.update({
      where: { id: profile.id },
      data: { pediatricExperience: existing ? `${existing}\n${line}` : line }
    });
    return;
  }

  if (field.mappedSection === "Documents") {
    return;
  }

  if (field.mappedSection === "Employment History") {
    const current = await prisma.employmentHistory.findFirst({ where: { applicationId: application.id } });
    const data: Record<string, unknown> = {};
    if (field.fieldKey === "employerName") data.employerName = value;
    if (field.fieldKey === "jobTitle") data.roleTitle = value;
    if (field.fieldKey === "startDate") data.startDate = parseDate(value);
    if (field.fieldKey === "endDate") data.endDate = parseDate(value);
    if (field.fieldKey === "supervisorName") data.supervisorName = value;
    if (field.fieldKey === "supervisorPhone") data.supervisorPhone = value;
    if (field.fieldKey === "pediatricCareDuties" || field.fieldKey === "reasonForLeaving") data.duties = value;
    if (field.fieldKey === "hasPediatricExperience") data.pediatricCare = /yes|true/i.test(value);
    if (current) {
      await prisma.employmentHistory.update({ where: { id: current.id }, data });
    } else {
      await prisma.employmentHistory.create({
        data: {
          applicantProfileId: profile.id,
          applicationId: application.id,
          employerName: field.fieldKey === "employerName" ? value : "Manual entry required",
          roleTitle: field.fieldKey === "jobTitle" ? value : "Manual entry required",
          ...data
        }
      });
    }
    return;
  }

  if (field.mappedSection === "Licenses") {
    const current = await prisma.license.findFirst({ where: { applicationId: application.id } });
    const data: Record<string, unknown> = {};
    if (field.fieldKey === "licenseType") data.type = value;
    if (field.fieldKey === "licenseNumber") data.licenseNumber = value;
    if (field.fieldKey === "issuingState") data.issuingState = value;
    if (field.fieldKey === "issueDate") data.issueDate = parseDate(value);
    if (field.fieldKey === "expirationDate") data.expiresAt = parseDate(value);
    if (current) await prisma.license.update({ where: { id: current.id }, data });
    else await prisma.license.create({ data: { applicantProfileId: profile.id, applicationId: application.id, type: field.fieldKey === "licenseType" ? value : "Manual entry required", ...data } });
    return;
  }

  if (field.mappedSection === "Certifications") {
    const current = await prisma.certification.findFirst({ where: { applicationId: application.id } });
    const data: Record<string, unknown> = {};
    if (field.fieldKey === "certificationType") data.name = value;
    if (field.fieldKey === "issueDate") data.issueDate = parseDate(value);
    if (field.fieldKey === "expirationDate") data.expiresAt = parseDate(value);
    if (current) await prisma.certification.update({ where: { id: current.id }, data });
    else await prisma.certification.create({ data: { applicantProfileId: profile.id, applicationId: application.id, name: field.fieldKey === "certificationType" ? value : "Manual entry required", ...data } });
    return;
  }

  if (field.mappedSection === "References") {
    const current = await prisma.reference.findFirst({ where: { applicationId: application.id } });
    const data: Record<string, unknown> = {};
    if (field.fieldKey === "name" || field.fieldKey === "referenceName") data.name = value;
    if (field.fieldKey === "referencePhone") data.phone = value;
    if (field.fieldKey === "referenceEmail") data.email = value;
    if (field.fieldKey === "relationship") data.relationship = value;
    if (field.fieldKey === "phone") data.phone = value;
    if (field.fieldKey === "email") data.email = value;
    if (field.fieldKey === "employer") data.employer = value;
    if (current) await prisma.reference.update({ where: { id: current.id }, data });
    else await prisma.reference.create({ data: { applicantProfileId: profile.id, applicationId: application.id, name: (field.fieldKey === "name" || field.fieldKey === "referenceName") ? value : "Manual entry required", ...data } });
  }
}

// Manual flow: an applicant or HR user explicitly confirms a single extracted
// field via the review UI. Honored only when applicantConfirmed=true.
export async function mapConfirmedField(fieldId: string) {
  const field = await prisma.extractedField.findUnique({
    where: { id: fieldId },
    include: { application: { include: { applicantProfile: { include: { user: true } } } } }
  });
  if (!field || !field.applicantConfirmed) return;
  await applyFieldToProfile(field, field.application);
}

// Auto-map flow: called by the intake processor right after a document's
// fields are extracted. Promotes high-confidence ExtractedField rows into
// the structured Prisma profile rows so the applicant/HR doesn't have to
// re-enter what the OCR already saw.
//
// `threshold` is the minimum confidence to auto-map. Anything below stays in
// pending_review for manual confirmation. Conservative default 0.6 catches
// email/phone/names/address/employer/job/license number while leaving
// genuinely uncertain extractions to a human.
export async function autoMapHighConfidenceFields(applicationId: string, threshold: number, actorUserId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicantProfile: { include: { user: true } } }
  });
  if (!application) return { mapped: 0, skipped: 0 };

  // Only consider fields that haven't been touched yet — pending_review is
  // the initial state set by the extractor. If a human already accepted /
  // corrected / rejected a field, leave it alone.
  const fields = await prisma.extractedField.findMany({
    where: { applicationId, status: "pending_review", confidence: { gte: threshold } }
  });

  let mapped = 0;
  for (const field of fields) {
    try {
      await applyFieldToProfile(field, application);
      await prisma.extractedField.update({
        where: { id: field.id },
        data: { applicantConfirmed: true, status: "accepted" }
      });
      mapped += 1;
    } catch (error) {
      // Don't let one bad field stop the whole batch — leave it in
      // pending_review so HR can fix manually.
      await logAction(actorUserId, "auto_map_field_failed", "extracted_field", field.id, {
        applicationId,
        fieldKey: field.fieldKey,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (mapped > 0) {
    await logAction(actorUserId, "auto_mapped_extracted_fields", "application", applicationId, {
      mapped,
      total: fields.length,
      threshold
    });
  }
  return { mapped, skipped: fields.length - mapped };
}
