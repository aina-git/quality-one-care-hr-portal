import type { ExtractedField } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function valueFor(field: ExtractedField) {
  return field.applicantCorrectedValue || field.extractedValue;
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function mapConfirmedField(fieldId: string) {
  const field = await prisma.extractedField.findUnique({
    where: { id: fieldId },
    include: { application: { include: { applicantProfile: { include: { user: true } } } } }
  });
  if (!field || !field.applicantConfirmed) return;

  const application = field.application;
  const profile = application.applicantProfile;
  const value = valueFor(field);

  if (field.mappedSection === "Personal Info") {
    if (field.fieldKey === "name") {
      await prisma.user.update({ where: { id: profile.userId }, data: { name: value } });
    }
    if (field.fieldKey === "phone") {
      await prisma.applicantProfile.update({ where: { id: profile.id }, data: { phone: value } });
    }
    if (field.fieldKey === "dateOfBirth") {
      const date = parseDate(value);
      if (date) await prisma.applicantProfile.update({ where: { id: profile.id }, data: { dateOfBirth: date } });
    }
    if (field.fieldKey === "address") {
      await prisma.applicantProfile.update({ where: { id: profile.id }, data: { address: value } });
    }
    return;
  }

  if (field.mappedSection === "Pediatric Experience") {
    const existing = profile.pediatricExperience || "";
    await prisma.applicantProfile.update({
      where: { id: profile.id },
      data: { pediatricExperience: existing ? `${existing}\n${field.fieldLabel}: ${value}` : `${field.fieldLabel}: ${value}` }
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
    else await prisma.reference.create({ data: { applicantProfileId: profile.id, applicationId: application.id, name: field.fieldKey === "name" ? value : "Manual entry required", ...data } });
  }
}
