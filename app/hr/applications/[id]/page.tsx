import Link from "next/link";
import { redirect } from "next/navigation";
import { ApplicantProgressTimeline } from "@/components/ApplicantProgressTimeline";
import { ApplicationWorkflowControls } from "@/components/ApplicationWorkflowControls";
import { CalendarEventForm } from "@/components/CalendarEventForm";
import { DashboardShell } from "@/components/DashboardShell";
import { MessageComposer } from "@/components/MessageComposer";
import { OperationalPulse } from "@/components/OperationalPulse";
import { StatusBadge } from "@/components/StatusBadge";
import { TaskForm } from "@/components/TaskForm";
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

export default async function ApplicationCaseFilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["hr", "admin", "super_admin_hr", "don_approver", "executive_view_only"]);
  const { id } = await params;
  const { tab = "summary" } = await searchParams;
  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      applicantProfile: { include: { user: true } },
      employmentHistory: true,
      licenses: true,
      certifications: true,
      references: true,
      documents: true,
      aiReviewReports: { orderBy: { createdAt: "desc" }, take: 1 },
      finalVerificationChecklist: { include: { items: true } },
      communicationLogs: { orderBy: { createdAt: "desc" }, take: 25 },
      tasks: { orderBy: { createdAt: "desc" }, take: 25 },
      calendarEvents: { orderBy: { startDateTime: "asc" }, take: 25 },
      employeeOnboarding: { include: { tasks: true } },
      trainingRecommendations: true
    }
  }).catch(() => null);
  if (!application) redirect("/hr/applications");
  await logAction(user.id, "application_case_file_viewed", "application", id);
  const audit = await prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "desc" }, take: 30 });
  const canEdit = ["hr", "admin", "super_admin_hr"].includes(user.role);
  const progress = await getApplicationProgress(application.id);
  const tabs = ["summary", "profile", "documents", "screening_review", "verification", "messages", "tasks", "calendar", "onboarding", "training", "audit_history"];

  return (
    <DashboardShell user={user} nav={[{ href: "/hr/dashboard", label: "Dashboard" }, { href: "/hr/applications", label: "Applications" }, { href: "/hr/training", label: "Training" }]}>
      <div className="grid gap-6">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-orange-600">Application Case File</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">{application.applicantProfile.user.name ?? application.applicantProfile.user.email}</h1>
          <div className="mt-4 flex flex-wrap gap-2"><StatusBadge status={application.status} /><span className="rounded-full border bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">Screening review: {application.aiReviewReports[0]?.status ?? "not run"}</span></div>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            {tabs.map((item) => <Link key={item} href={`/hr/applications/${id}?tab=${item}`} className={`rounded-full border px-3 py-1 ${tab === item ? "bg-orange-600 text-white" : "bg-white"}`}>{label(item)}</Link>)}
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-4">
          <OperationalPulse label="Documents" value={application.documents.length} icon="check" color="blue" />
          <OperationalPulse label="Tasks" value={application.tasks.length} icon="clock" color="orange" />
          <OperationalPulse label="Messages" value={application.communicationLogs.length} icon="message" color="green" />
          <OperationalPulse label="Calendar Events" value={application.calendarEvents.length} icon="calendar" color="teal" />
        </div>

        {tab === "summary" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><Card><CardHeader><CardTitle>Summary</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm"><p>Role: {application.desiredRole ?? "Not recorded"}</p><p>Submitted: {application.submittedAt?.toLocaleString("en-US") ?? "Not submitted"}</p><p>Phone: {application.applicantProfile.phone ?? "Not recorded"}</p><p>Email: {application.applicantProfile.user.email}</p><p>Next action: {progress?.nextActionRequired ?? "Monitor workflow."}</p><div className="flex flex-wrap gap-2 pt-3"><Link className="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white" href={`/hr/applications/${id}/review`}>Open Screening Review</Link><Link className="rounded-md border px-3 py-2 text-sm font-medium" href={`/hr/applications/${id}/verification`}>Final Verification</Link><Link className="rounded-md border px-3 py-2 text-sm font-medium" href={`/hr/applicants/${application.applicantProfileId}`}>Applicant Profile</Link></div>{progress ? <div className="pt-3"><ApplicantProgressTimeline stages={progress.stages} compact /></div> : null}</CardContent></Card><Card><CardHeader><CardTitle>Workflow Controls</CardTitle></CardHeader><CardContent>{canEdit ? <ApplicationWorkflowControls applicationId={application.id} currentStatus={application.status} /> : <p className="text-sm text-muted-foreground">Read-only access.</p>}</CardContent></Card></div>}

        {tab === "profile" && <Card><CardHeader><CardTitle>Applicant Profile</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm"><p>Name: {application.applicantProfile.user.name ?? "-"}</p><p>Email: {application.applicantProfile.user.email}</p><p>Phone: {application.applicantProfile.phone ?? "-"}</p><p>Address: {[application.applicantProfile.address, application.applicantProfile.city, application.applicantProfile.state, application.applicantProfile.zip].filter(Boolean).join(", ") || "-"}</p><p>Pediatric Experience: {application.applicantProfile.pediatricExperience ?? "-"}</p><p className="text-xs text-muted-foreground">Edit controls are role-gated; detailed form editing can be expanded from this case file surface.</p></CardContent></Card>}

        {tab === "documents" && <Card><CardHeader><CardTitle>Documents</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader><TableBody>{application.documents.map((doc) => <TableRow key={doc.id}><TableCell>{doc.fileName}</TableCell><TableCell>{doc.documentType}</TableCell><TableCell>{doc.processingStatus}</TableCell><TableCell>{doc.updatedAt.toLocaleDateString("en-US")}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}

        {tab === "screening_review" && <Card><CardHeader><CardTitle>System-Assisted Screening Review</CardTitle></CardHeader><CardContent><pre className="whitespace-pre-wrap rounded-md bg-purple-50 p-3 text-sm">{JSON.stringify(application.aiReviewReports[0] ?? { status: "not run" }, null, 2)}</pre></CardContent></Card>}

        {tab === "verification" && <Card><CardHeader><CardTitle>Verification</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm">{application.finalVerificationChecklist?.items.map((item) => <div key={item.id} className="rounded-md border bg-slate-50 p-3"><p className="font-medium">{item.title}</p><p>{label(item.status)}</p></div>) ?? <p>No final verification checklist yet.</p>}</CardContent></Card>}

        {tab === "messages" && <Card><CardHeader><CardTitle>Messages</CardTitle></CardHeader><CardContent className="grid gap-4">{canEdit ? <MessageComposer applicationId={id} /> : null}{application.communicationLogs.map((message) => <div key={message.id} className="rounded-md border bg-slate-50 p-3 text-sm"><p className="font-medium">{message.subject}</p><p>{message.body}</p><p className="mt-1 text-xs text-muted-foreground">{label(message.channel)} - {label(message.status)} - {message.createdAt.toLocaleString("en-US")}</p></div>)}</CardContent></Card>}

        {tab === "tasks" && <Card><CardHeader><CardTitle>Tasks</CardTitle></CardHeader><CardContent className="grid gap-4">{canEdit ? <TaskForm applicationId={id} applicantUserId={application.applicantProfile.userId} /> : null}{application.tasks.map((task) => <div key={task.id} className="rounded-md border bg-slate-50 p-3 text-sm"><p className="font-medium">{task.title}</p><p>{task.description}</p><p className="mt-1 text-xs">{label(task.priority)} - {label(task.status)}</p></div>)}</CardContent></Card>}

        {tab === "calendar" && <Card><CardHeader><CardTitle>Calendar</CardTitle></CardHeader><CardContent className="grid gap-4">{canEdit ? <CalendarEventForm applicationId={id} applicantUserId={application.applicantProfile.userId} /> : null}{application.calendarEvents.map((event) => <div key={event.id} className="rounded-md border bg-blue-50 p-3 text-sm"><p className="font-medium">{event.title}</p><p>{event.startDateTime.toLocaleString("en-US")} to {event.endDateTime.toLocaleString("en-US")}</p><p className="mt-1 text-xs">{label(event.eventType)} - {label(event.status)}</p></div>)}</CardContent></Card>}

        {tab === "onboarding" && <Card><CardHeader><CardTitle>Onboarding</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm">{application.employeeOnboarding?.tasks.map((task) => <div key={task.id} className="rounded-md border bg-teal-50 p-3"><p className="font-medium">{task.title}</p><p>{label(task.status)}</p></div>) ?? <p>No employee onboarding yet.</p>}</CardContent></Card>}

        {tab === "training" && <Card><CardHeader><CardTitle>Training</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm">{application.trainingRecommendations.map((item) => <div key={item.id} className="rounded-md border bg-purple-50 p-3"><p className="font-medium">{item.trainingTitle}</p><p>{item.reason}</p><p className="mt-1 text-xs">{label(item.priority)} - {label(item.status)}</p></div>)}</CardContent></Card>}

        {tab === "audit_history" && <Card><CardHeader><CardTitle>Audit History</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm">{audit.map((entry) => <div key={entry.id} className="rounded-md border bg-slate-50 p-3"><p className="font-medium">{entry.action}</p><p className="text-xs text-muted-foreground">{entry.createdAt.toLocaleString("en-US")}</p></div>)}</CardContent></Card>}
      </div>
    </DashboardShell>
  );
}
