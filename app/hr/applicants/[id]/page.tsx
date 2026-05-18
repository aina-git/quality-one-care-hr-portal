import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplicantProgressTimeline } from "@/components/ApplicantProgressTimeline";
import { DashboardShell } from "@/components/DashboardShell";
import { IdentityPhotoFlagForm } from "@/components/IdentityPhotoFlagForm";
import { MessageComposer } from "@/components/MessageComposer";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getApplicationProgress } from "@/services/applicantProgressService";

function label(value: string | null | undefined) {
  if (!value) return "-";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function ApplicantProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "super_admin_hr", "don_approver", "executive_view_only"]);
  const { id } = await params;
  const applicant = await prisma.applicantProfile.findUnique({
    where: { id },
    include: {
      user: true,
      applications: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: {
          documents: true,
          employmentHistory: true,
          licenses: true,
          certifications: true,
          references: true,
          finalVerificationChecklist: { include: { items: { include: { verifiedByUser: true, document: true } } } },
          hrNotes: { include: { createdBy: true }, orderBy: { createdAt: "desc" } },
          communicationLogs: { include: { sender: true }, orderBy: { createdAt: "desc" }, take: 20 },
          applicantMessages: { include: { sender: true }, orderBy: { createdAt: "desc" }, take: 20 },
          decisions: { include: { createdBy: true }, orderBy: { createdAt: "desc" }, take: 5 },
          statusHistory: { include: { changedBy: true }, orderBy: { createdAt: "desc" } },
          employeeOnboarding: true
        }
      }
    }
  });
  if (!applicant) redirect("/hr/applications");
  const application = applicant.applications[0];
  if (!application) redirect("/hr/applications");
  await logAction(user.id, "applicant_profile_viewed", "applicant_profile", applicant.id, { applicationId: application.id });
  const progress = await getApplicationProgress(application.id);
  const profilePhoto = await prisma.uploadedDocument.findFirst({
    where: { applicantProfileId: applicant.id, documentType: "profile_photo" },
    orderBy: { createdAt: "desc" }
  });
  const audit = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityId: application.id },
        { entityId: applicant.id },
        ...(application.finalVerificationChecklist ? [{ entityId: application.finalVerificationChecklist.id }] : [])
      ]
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  const canEdit = ["hr", "super_admin_hr"].includes(user.role);

  return (
    <DashboardShell user={user} nav={[
      { href: "/hr/dashboard", label: "Dashboard" },
      { href: "/hr/applications", label: "Applications" },
      { href: "/hr/verification", label: "Final Verification" },
      { href: "/hr/training", label: "Training" }
    ]}>
      <div className="grid gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <ProfilePhoto document={profilePhoto} viewerUserId={user.id} name={applicant.user.name ?? applicant.user.email} size="lg" />
            <div>
              <p className="text-sm font-semibold text-orange-600">Applicant Profile</p>
              <h1 className="mt-2 text-3xl font-semibold">{applicant.user.name ?? applicant.user.email}</h1>
              <p className="mt-1 text-sm text-slate-500">Identity photo status: {label(applicant.identityPhotoStatus)}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge status={application.status} />
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">Role: {application.desiredRole ?? "Not recorded"}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">Last updated {progress?.lastUpdated.toLocaleString("en-US") ?? application.updatedAt.toLocaleString("en-US")}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href={`/hr/applications/${application.id}`}>Open Case File</Link></Button>
            <Button asChild variant="outline"><Link href={`/hr/applications/${application.id}/review`}>Screening Review</Link></Button>
            <Button asChild><Link href={`/hr/applications/${application.id}/verification`}>Verification Workspace</Link></Button>
          </div>
        </section>

        {progress ? (
          <Card>
            <CardHeader><CardTitle>Applicant Monitoring</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
                  <p className="font-semibold">Current stage</p>
                  <p>{progress.activeStage.label}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <p className="font-semibold">Responsible staff</p>
                  <p>{progress.responsibleStaff}</p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                  <p className="font-semibold">Next action required</p>
                  <p>{progress.nextActionRequired}</p>
                </div>
              </div>
              <ApplicantProgressTimeline stages={progress.stages} />
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p><span className="font-semibold">Email:</span> {applicant.user.email}</p>
              <p><span className="font-semibold">Phone:</span> {applicant.phone ?? "-"}</p>
              <p><span className="font-semibold">Address:</span> {[applicant.address, applicant.city, applicant.state, applicant.zip].filter(Boolean).join(", ") || "-"}</p>
              <p><span className="font-semibold">Pediatric experience:</span> {applicant.pediatricExperience ?? "-"}</p>
              <p><span className="font-semibold">Photo consent:</span> {applicant.profilePhotoConsentAt ? applicant.profilePhotoConsentAt.toLocaleString("en-US") : "Missing"}</p>
              <p><span className="font-semibold">Identity photo note:</span> {applicant.identityPhotoNotes ?? "-"}</p>
              {canEdit ? <IdentityPhotoFlagForm applicantProfileId={applicant.id} /> : null}
              {canEdit ? <Button variant="outline" size="sm">Edit Profile</Button> : <p className="text-xs text-slate-500">Read-only role.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>DON Decision Summary</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p><span className="font-semibold">Checklist status:</span> {label(application.finalVerificationChecklist?.status)}</p>
              <p><span className="font-semibold">DON decision:</span> {label(application.finalVerificationChecklist?.donDecision)}</p>
              <p><span className="font-semibold">Comment:</span> {application.finalVerificationChecklist?.donComment ?? "-"}</p>
              <Button asChild variant="outline" size="sm"><Link href={`/don/final-approval/${application.id}`}>Open DON Report</Link></Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Uploaded Documents</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Detected</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {application.documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>{doc.fileName}</TableCell>
                    <TableCell>{doc.documentType}</TableCell>
                    <TableCell>{doc.detectedDocumentType ?? "-"}</TableCell>
                    <TableCell>{label(doc.processingStatus)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Verification Checklist</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Status</TableHead><TableHead>Evidence</TableHead><TableHead>Verified By</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
              <TableBody>
                {application.finalVerificationChecklist?.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>{label(item.status)}</TableCell>
                    <TableCell>{item.document?.fileName ?? "-"}</TableCell>
                    <TableCell>{item.verifiedByUser?.name ?? item.verifiedByUser?.email ?? "-"}</TableCell>
                    <TableCell>{item.notes ?? "-"}</TableCell>
                  </TableRow>
                )) ?? <TableRow><TableCell colSpan={5}>No final verification checklist yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Message History</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {canEdit ? <MessageComposer applicationId={application.id} compact /> : null}
              {application.communicationLogs.map((message) => (
                <div key={message.id} className="rounded-xl border bg-slate-50 p-3">
                  <p className="font-semibold">{message.subject}</p>
                  <p className="mt-1 text-slate-600">{message.body}</p>
                  <p className="mt-2 text-xs text-slate-500">{label(message.channel)} - {label(message.status)} - {message.sender?.name ?? message.sender?.email ?? "System"} - {message.createdAt.toLocaleString("en-US")}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Internal HR Notes</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {application.hrNotes.map((note) => (
                <div key={note.id} className="rounded-xl border bg-slate-50 p-3">
                  <p>{note.note}</p>
                  <p className="mt-2 text-xs text-slate-500">{note.createdBy.name ?? note.createdBy.email} - {note.createdAt.toLocaleString("en-US")}</p>
                </div>
              ))}
              {!application.hrNotes.length ? <p className="text-slate-500">No internal notes yet.</p> : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Audit Trail</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {audit.map((entry) => (
              <div key={entry.id} className="rounded-xl border bg-slate-50 p-3">
                <p className="font-semibold">{entry.action}</p>
                <p className="text-xs text-slate-500">{entry.createdAt.toLocaleString("en-US")} by {entry.user?.name ?? entry.user?.email ?? "System"}</p>
              </div>
            ))}
            {!audit.length ? <p className="text-slate-500">No audit entries found for this profile.</p> : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
