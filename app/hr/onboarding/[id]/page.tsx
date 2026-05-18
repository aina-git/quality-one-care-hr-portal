import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { EmployeeOnboardingTaskActions } from "@/components/EmployeeOnboardingTaskActions";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function label(value: string | null | undefined) {
  if (!value) return "-";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function HrEmployeeOnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["hr", "super_admin_hr"]);
  const { id } = await params;
  const onboarding = await prisma.employeeOnboarding.findUnique({
    where: { id },
    include: {
      application: { include: { applicantProfile: { include: { user: true } }, trainingRecommendations: true } },
      tasks: { orderBy: { createdAt: "asc" }, include: { assignedTo: true, completedBy: true } }
    }
  });
  if (!onboarding) redirect("/hr/applications");
  const complete = onboarding.tasks.filter((task) => task.status !== "pending").length;

  return (
    <DashboardShell user={user} nav={[{ href: "/hr/dashboard", label: "Dashboard" }, { href: "/hr/applications", label: "Applications" }, { href: "/hr/training", label: "Training" }]}>
      <div className="grid gap-6">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-orange-600">Employee Onboarding</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">{onboarding.application.applicantProfile.user.name ?? onboarding.application.applicantProfile.user.email}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge status={onboarding.application.status} />
            <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">{label(onboarding.status)}</span>
          </div>
        </section>

        <Card>
          <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p>{complete} of {onboarding.tasks.length} tasks complete or waived.</p>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-orange-500" style={{ width: `${onboarding.tasks.length ? Math.round((complete / onboarding.tasks.length) * 100) : 0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onboarding.tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell><p className="font-medium">{task.title}</p><p className="text-xs text-muted-foreground">{task.description}</p></TableCell>
                    <TableCell>{task.assignedTo ? task.assignedTo.name ?? task.assignedTo.email : "Unassigned"}</TableCell>
                    <TableCell>{task.dueDate ? task.dueDate.toLocaleDateString("en-US") : "-"}</TableCell>
                    <TableCell>{label(task.status)}</TableCell>
                    <TableCell><EmployeeOnboardingTaskActions taskId={task.id} currentStatus={task.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Training Recommendations</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {onboarding.application.trainingRecommendations.map((item) => (
              <div key={item.id} className="rounded-md border bg-slate-50 p-3">
                <p className="font-medium">{item.trainingTitle}</p>
                <p className="text-muted-foreground">{item.reason}</p>
                <p className="mt-1 text-xs uppercase text-orange-700">{item.priority} priority - {label(item.status)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
