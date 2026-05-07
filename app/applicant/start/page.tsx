import Link from "next/link";
import { ArrowRight, ClipboardList, FileStack, ScanLine, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";

export default async function ApplicantStartPage() {
  const user = await requireRole(["applicant"]);
  return (
    <DashboardShell
      user={user}
      nav={[
        { href: "/applicant/dashboard", label: "Dashboard" },
        { href: "/applicant/intake", label: "Intake Wizard" },
        { href: "/applicant/quick-upload", label: "Upload Documents" },
        { href: "/applicant/application", label: "Application" }
      ]}
    >
      <div className="grid gap-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 shadow-sm sm:p-8">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-orange-200/40 blur-3xl" aria-hidden />
          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">
              <Sparkles size={12} /> Welcome to Quality One Care
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Hi {user.name?.split(" ")[0] ?? "there"} — let&apos;s get you set up.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-700 sm:text-base">
              We&apos;ll guide you through your application, credentials, and new-hire forms — one short step at a time. Your progress saves automatically, so you can pause and pick up later.
            </p>
            <div className="mt-5">
              <Button asChild size="lg">
                <Link href="/applicant/intake">Begin step-by-step packet <ArrowRight size={16} /></Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Alternate paths */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Other ways to start</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <ScanLine size={22} className="text-orange-600" />
                <p className="mt-3 font-semibold text-slate-900">Upload completed paper application</p>
                <p className="mt-1 text-sm text-slate-600">Already filled out a printed packet? Scan it and upload — we&apos;ll organize the contents.</p>
                <Button asChild variant="outline" size="sm" className="mt-3"><Link href="/applicant/quick-upload?mode=paper">Upload scanned packet</Link></Button>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <FileStack size={22} className="text-orange-600" />
                <p className="mt-3 font-semibold text-slate-900">Upload supporting documents</p>
                <p className="mt-1 text-sm text-slate-600">Resume, license, ID, CPR card, immunization records — drop them in and we&apos;ll route each one.</p>
                <Button asChild variant="outline" size="sm" className="mt-3"><Link href="/applicant/quick-upload?mode=supporting_documents">Upload documents</Link></Button>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <ClipboardList size={22} className="text-orange-600" />
                <p className="mt-3 font-semibold text-slate-900">Classic application form</p>
                <p className="mt-1 text-sm text-slate-600">Prefer a single long form? You can also fill the legacy application page and submit when ready.</p>
                <Button asChild variant="outline" size="sm" className="mt-3"><Link href="/applicant/application">Open classic form</Link></Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-blue-100 bg-blue-50/40">
          <CardContent className="p-4 text-sm text-blue-900">
            <p className="font-semibold">Need help?</p>
            <p className="mt-1">
              Email <a className="font-semibold hover:underline" href="mailto:info@qualityonecare.com">info@qualityonecare.com</a>{" "}
              or call <span className="font-semibold">(301) 658-7141</span>. We&apos;re here Monday–Friday.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
