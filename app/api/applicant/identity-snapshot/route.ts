import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Returns whatever name + address the OCR pipeline pulled off the applicant's
 * most recent ID / driver's license document. The applicant-facing
 * IdentityMatchBadge uses this to compare what they're typing now against
 * what's on the document they uploaded.
 *
 * Empty fields are returned as null. If no ID/DL is on file at all, all
 * fields are null and the UI hides the badge silently.
 */
export async function GET() {
  const user = await requireRole(["applicant"]);
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: user.id },
    include: { applications: { orderBy: { updatedAt: "desc" }, take: 1 } }
  });
  if (!profile || !profile.applications[0]) {
    return NextResponse.json({ name: null, address: null, dateOfBirth: null, licenseNumber: null, sourceFileName: null });
  }
  const application = profile.applications[0];

  // Documents most likely to carry an ID/DL extract.
  const idDocs = await prisma.uploadedDocument.findMany({
    where: {
      applicationId: application.id,
      OR: [
        { detectedDocumentType: { contains: "license", mode: "insensitive" } },
        { detectedDocumentType: { contains: "id", mode: "insensitive" } },
        { documentType: { contains: "ID", mode: "insensitive" } },
        { documentType: { contains: "license", mode: "insensitive" } },
        { documentType: { contains: "passport", mode: "insensitive" } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, fileName: true }
  });

  if (idDocs.length === 0) {
    return NextResponse.json({ name: null, address: null, dateOfBirth: null, licenseNumber: null, sourceFileName: null });
  }

  const fields = await prisma.extractedField.findMany({
    where: {
      applicationId: application.id,
      sourceDocumentId: { in: idDocs.map((d) => d.id) },
      fieldKey: { in: ["name", "firstName", "lastName", "address", "dateOfBirth", "licenseNumber", "licenseType"] }
    },
    orderBy: { createdAt: "desc" }
  });

  // Pick the most recent value per fieldKey across all ID/DL docs.
  function latest(key: string): { value: string; sourceDocumentId: string } | null {
    const match = fields.find((f) => f.fieldKey === key);
    return match ? { value: match.applicantCorrectedValue ?? match.extractedValue, sourceDocumentId: match.sourceDocumentId } : null;
  }

  const nameField = latest("name");
  const firstField = latest("firstName");
  const lastField = latest("lastName");
  const fullName = nameField?.value
    ?? [firstField?.value, lastField?.value].filter(Boolean).join(" ").trim()
    ?? null;
  const sourceDocId = nameField?.sourceDocumentId ?? firstField?.sourceDocumentId ?? lastField?.sourceDocumentId ?? null;
  const sourceFileName = sourceDocId ? idDocs.find((d) => d.id === sourceDocId)?.fileName ?? null : null;

  return NextResponse.json({
    name: fullName || null,
    address: latest("address")?.value ?? null,
    dateOfBirth: latest("dateOfBirth")?.value ?? null,
    licenseNumber: latest("licenseNumber")?.value ?? null,
    licenseType: latest("licenseType")?.value ?? null,
    sourceFileName
  });
}
