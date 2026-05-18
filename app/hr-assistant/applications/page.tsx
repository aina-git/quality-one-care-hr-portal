import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ASSISTANT_NAV = [
  { href: "/hr-assistant/dashboard", label: "Dashboard" },
  { href: "/hr-assistant/applications", label: "Applications" }
];

function formatDate(d: Date | null | undefined) {
  if (!d) return "--";
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-US") : "--";
}

export default async function HrAssistantApplications() {
  const user = await requireRole(["hr_assistant"]);

  const applications = await prisma.application.findMany({
    where: { status: { not: "draft" } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      applicantProfile: {
        include: {
          user: { select: { name: true, email: true } }
        }
      },
      licenses: { take: 1, orderBy: { createdAt: "desc" } }
    }
  });

  const profilePhotos = await prisma.uploadedDocument.findMany({
    where: {
      id: {
        in: applications
          .map((a) => a.applicantProfile.profilePhotoDocumentId)
          .filter((id): id is string => !!id)
      }
    },
    select: { id: true, fileName: true }
  });
  const photoMap = new Map(profilePhotos.map((p) => [p.id, p]));

  return (
    <DashboardShell user={user} nav={ASSISTANT_NAV}>
      <div className="grid gap-5">
        <div>
          <Link href="/hr-assistant/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText size={16} /> All Applications
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">Read-only view. Contact the HR Coordinator to make changes.</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-slate-500">No applications found.</TableCell></TableRow>
                  )}
                  {applications.map((app) => {
                    const profile = app.applicantProfile;
                    const photo = profile.profilePhotoDocumentId ? photoMap.get(profile.profilePhotoDocumentId) ?? null : null;
                    const license = app.licenses[0];
                    return (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ProfilePhoto document={photo} viewerUserId={user.id} name={profile.user.name} size="sm" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{profile.user.name ?? profile.user.email}</p>
                              <p className="text-xs text-slate-500 truncate">{profile.user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">{app.desiredRole ?? "--"}</TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {license ? `${license.type}${license.licenseNumber ? ` ${license.licenseNumber}` : ""}` : "--"}
                        </TableCell>
                        <TableCell><StatusBadge status={app.status} /></TableCell>
                        <TableCell className="text-sm text-slate-500">{formatDate(app.submittedAt ?? app.applicationSubmittedAt)}</TableCell>
                        <TableCell className="text-sm text-slate-500">{formatDate(app.updatedAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
