import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplicantProgressTimeline } from "@/components/ApplicantProgressTimeline";
import { DashboardShell } from "@/components/DashboardShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLatestApplicantApplication } from "@/services/applicationService";
import { getApplicationProgress } from "@/services/applicantProgressService";

export default async function ApplicantProgressPage() {
  const user = await requireRole(["applicant"]);
  const { application } = await getLatestApplicantApplication(user.id);
  if (!application) redirect("/applicant/application");
  const progress = await getApplicationProgress(application.id);
  const latestMessages = await prisma.applicantMessage.findMany({
    where: { applicationId: application.id, visibleToApplicant: true },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  return (
    <DashboardShell user={user} nav={[
      { href: "/applicant/dashboard", label: "Dashboard" },
      { href: "/applicant/progress", label: "Application Progress" },
      { href: "/applicant/quick-upload", label: "Upload Documents" },
      { href: "/applicant/intake-status", label: "Intake Status" },
      { href: "/applicant/application", label: "Application" },
      { href: "/applicant/messages", label: "Messages" }
    ]}>
      <div className="grid gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-orange-600">Your Application Progress</p>
          <h1 className="mt-2 text-3xl font-semibold">Quality One Care hiring steps</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge status={application.status} />
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              Last updated {progress?.lastUpdated.toLocaleString() ?? application.updatedAt.toLocaleString()}
            </span>
          </div>
        </section>

        {progress ? (
          <Card>
            <CardHeader>
              <CardTitle>{progress.activeStage.label}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
                <p className="font-semibold">Next action</p>
                <p className="mt-1">{progress.nextActionRequired}</p>
              </div>
              <ApplicantProgressTimeline stages={progress.stages} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader><CardTitle>Recent Applicant Messages</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {latestMessages.length ? latestMessages.map((message) => (
              <div key={message.id} className="rounded-xl border bg-slate-50 p-3">
                <p className="font-semibold">{message.subject}</p>
                <p className="mt-1 text-slate-600">{message.body}</p>
                <p className="mt-2 text-xs text-slate-500">{message.createdAt.toLocaleString()}</p>
              </div>
            )) : <p className="text-slate-500">No messages yet.</p>}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href="/applicant/messages">Open Messages</Link></Button>
              <Button asChild><Link href="/applicant/application">Continue Application</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
