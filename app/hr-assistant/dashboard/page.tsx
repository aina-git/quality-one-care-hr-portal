import Link from "next/link";
import { ArrowRight, Clock, FileText, ShieldCheck, Upload, Users } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { DashboardClock } from "@/components/DashboardClock";
import { PersonalTodoList } from "@/components/PersonalTodoList";
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

export default async function HrAssistantDashboard() {
  const user = await requireRole(["hr_assistant"]);

  const pendingApps = await prisma.application.count({
    where: { status: { in: ["submitted", "resubmitted", "hr_review_pending", "hr_review_started"] } }
  });
  const inVerification = await prisma.application.count({
    where: { status: { in: ["verification_in_progress", "ready_for_verification"] } }
  });
  const totalApplicants = await prisma.applicantProfile.count();
  const pendingDocs = await prisma.uploadedDocument.count();

  const recentApps = await prisma.application.findMany({
    where: { status: { not: "draft" } },
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: {
      applicantProfile: {
        include: {
          user: { select: { name: true, email: true } },
        }
      }
    }
  });

  const profilePhotos = await prisma.uploadedDocument.findMany({
    where: {
      id: {
        in: recentApps
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
        {/* Welcome */}
        <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-white">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">HR Assistant</p>
                <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                  Welcome back, {user.name ?? user.email}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  View applicant status and track document progress.
                </p>
              </div>
              <DashboardClock />
            </div>
          </CardContent>
        </Card>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4 text-center">
              <Users size={20} className="mx-auto text-blue-600" />
              <p className="mt-2 text-2xl font-bold text-blue-900">{totalApplicants}</p>
              <p className="text-xs font-medium text-blue-700">Total Applicants</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-center">
              <Clock size={20} className="mx-auto text-amber-600" />
              <p className="mt-2 text-2xl font-bold text-amber-900">{pendingApps}</p>
              <p className="text-xs font-medium text-amber-700">Pending Review</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4 text-center">
              <ShieldCheck size={20} className="mx-auto text-emerald-600" />
              <p className="mt-2 text-2xl font-bold text-emerald-900">{inVerification}</p>
              <p className="text-xs font-medium text-emerald-700">In Verification</p>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="p-4 text-center">
              <Upload size={20} className="mx-auto text-purple-600" />
              <p className="mt-2 text-2xl font-bold text-purple-900">{pendingDocs}</p>
              <p className="text-xs font-medium text-purple-700">Documents Uploaded</p>
            </CardContent>
          </Card>
        </div>

        {/* My to-do list */}
        <PersonalTodoList />

        {/* Recent applications (read-only view) */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText size={16} /> Recent Applications
            </CardTitle>
            <Link href="/hr-assistant/applications" className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:underline">
              View all <ArrowRight size={12} />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentApps.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-slate-500">No applications found.</TableCell></TableRow>
                  )}
                  {recentApps.map((app) => {
                    const profile = app.applicantProfile;
                    const photo = profile.profilePhotoDocumentId ? photoMap.get(profile.profilePhotoDocumentId) ?? null : null;
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
                        <TableCell><StatusBadge status={app.status} /></TableCell>
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
