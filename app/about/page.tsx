import Link from "next/link";
import { ArrowLeft, Info, Shield, Tag } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { APP_COPYRIGHT, APP_NAME, APP_VERSION, VERSION_HISTORY } from "@/lib/version";

function dashboardHref(role: string) {
  if (role === "applicant") return "/applicant/dashboard";
  if (role === "scheduler_limited") return "/scheduler/dashboard";
  if (role === "don_approver") return "/don/approval-queue";
  if (role === "admin" || role === "super_admin_hr") return "/admin/dashboard";
  return "/hr/dashboard";
}

export default async function AboutPage() {
  const user = await requireAuth();
  const nav = [{ href: dashboardHref(user.role), label: "Dashboard" }];

  return (
    <DashboardShell user={user} nav={nav}>
      <div className="grid gap-5 max-w-3xl">
        <div>
          <Link href={dashboardHref(user.role)} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>

        {/* App identity */}
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Quality One Care</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{APP_NAME}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-100 px-3 py-1 text-sm font-bold text-orange-800">
                <Tag size={14} /> v{APP_VERSION}
              </span>
              <span className="text-sm text-slate-600">Current version</span>
            </div>
          </CardContent>
        </Card>

        {/* Credits + License */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Shield size={16} /> License and Credits</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 grid gap-3 text-sm">
            <div className="grid grid-cols-[140px_1fr] py-1.5 border-b border-slate-100">
              <span className="font-medium text-slate-600">Built by</span>
              <span className="font-semibold text-slate-900">{APP_COPYRIGHT.builder}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] py-1.5 border-b border-slate-100">
              <span className="font-medium text-slate-600">Licensed to</span>
              <span className="font-semibold text-slate-900">{APP_COPYRIGHT.company}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr] py-1.5 border-b border-slate-100">
              <span className="font-medium text-slate-600">Copyright</span>
              <span className="text-slate-700">&copy; {APP_COPYRIGHT.year} {APP_COPYRIGHT.company}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">{APP_COPYRIGHT.notice}</p>
          </CardContent>
        </Card>

        {/* Version history */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Info size={16} /> Version History</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 grid gap-4">
            {VERSION_HISTORY.map((entry, i) => (
              <div key={entry.version} className={`rounded-lg border p-4 ${i === 0 ? "border-orange-200 bg-orange-50/40" : "border-slate-100 bg-slate-50/50"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${i === 0 ? "bg-orange-100 text-orange-800 border border-orange-200" : "bg-slate-200 text-slate-700"}`}>
                    v{entry.version}
                  </span>
                  <span className="font-semibold text-slate-900 text-sm">{entry.title}</span>
                  <span className="text-xs text-slate-500 ml-auto">{entry.date}</span>
                </div>
                <ul className="mt-2 grid gap-1 text-sm text-slate-700">
                  {entry.highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
