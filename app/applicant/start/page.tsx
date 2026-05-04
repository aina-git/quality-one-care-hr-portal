import Link from "next/link";
import { ClipboardList, FileStack, ScanLine } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";

const paths = [
  {
    title: "Start Full Digital Application",
    description: "For applicants filling everything online. Complete each section, upload documents, and submit when validation is ready.",
    href: "/applicant/application",
    action: "Start Online",
    icon: ClipboardList,
    tone: "border-blue-200 bg-blue-50 text-blue-950",
    iconTone: "text-blue-700",
    steps: "Enter details -> Upload documents -> System checks -> HR reviews"
  },
  {
    title: "Upload Completed & Scanned Application",
    description: "Already completed a paper application? Upload your scanned form and supporting documents. The system will organize and prepare it for HR review.",
    href: "/applicant/quick-upload?mode=paper",
    action: "Upload Scanned Application",
    icon: ScanLine,
    tone: "border-orange-200 bg-orange-50 text-orange-950",
    iconTone: "text-orange-700",
    recommended: true,
    steps: "Upload -> System organizes -> HR reviews -> Verification begins"
  },
  {
    title: "Upload Resume & Supporting Documents",
    description: "Upload your resume and any documents. The system will organize them and guide you through the remaining steps.",
    href: "/applicant/quick-upload?mode=supporting_documents",
    action: "Upload Materials",
    icon: FileStack,
    tone: "border-teal-200 bg-teal-50 text-teal-950",
    iconTone: "text-teal-700",
    steps: "Upload -> Classify -> Review missing items -> Continue application"
  }
];

export default async function ApplicantStartPage() {
  const user = await requireRole(["applicant"]);
  return (
    <DashboardShell
      user={user}
      nav={[
        { href: "/applicant/dashboard", label: "Dashboard" },
        { href: "/applicant/start", label: "Begin Intake" },
        { href: "/applicant/quick-upload", label: "Document Upload" },
        { href: "/applicant/application", label: "Application" },
        { href: "/applicant/intake-status", label: "Intake Status" }
      ]}
    >
      <div className="grid gap-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-orange-600">Choose how to begin</p>
          <h1 className="mt-2 text-3xl font-semibold">Start your Quality One Care application intake</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Choose how you would like to begin. You can complete your application online or upload existing documents for processing.
          </p>
        </section>
        <div className="grid gap-4 xl:grid-cols-3">
          {paths.map((path) => {
            const Icon = path.icon;
            return (
              <Card key={path.title} className={`qoc-card relative overflow-hidden rounded-2xl ${path.tone}`}>
                {path.recommended ? (
                  <span className="absolute right-4 top-4 rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">Recommended</span>
                ) : null}
                <CardHeader className="gap-3">
                  <Icon className={`h-9 w-9 ${path.iconTone}`} />
                  <CardTitle className="pr-28 text-xl">{path.title}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5 text-sm">
                  <p>{path.description}</p>
                  <div className="rounded-xl border border-white/80 bg-white/75 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Intake path</p>
                    <p className="mt-1 font-medium text-slate-800">{path.steps}</p>
                  </div>
                  <Button asChild>
                    <Link href={path.href}>{path.action}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
