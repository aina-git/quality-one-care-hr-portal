import { DashboardShell } from "@/components/DashboardShell";
import { NewIntakeLocationForm } from "@/components/NewIntakeLocationForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNav } from "@/lib/adminNav";

export default async function AdminIntakeLocationsPage() {
  const user = await requireRole(["admin", "super_admin_hr", "hr"]);
  const locations = await prisma.intakeLocation.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { applications: true } } }
  });

  return (
    <DashboardShell user={user} nav={adminNav}>
      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Intake locations</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-slate-600">
              Add the physical clinics, branches, or intake desks where applicants apply. Applicants and HR will see
              these in the &quot;Intake location&quot; dropdown when an application is created or edited.
            </p>
            <NewIntakeLocationForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Existing locations ({locations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <p className="text-sm text-slate-500">
                No intake locations yet. Add one above to make it available in the dropdown.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applications</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell>{loc.city ?? <span className="text-slate-400">—</span>}</TableCell>
                      <TableCell>
                        <span className={loc.isActive ? "text-emerald-700" : "text-slate-500"}>
                          {loc.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell>{loc._count.applications}</TableCell>
                      <TableCell className="text-sm text-slate-500">{loc.createdAt.toLocaleDateString("en-US")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
