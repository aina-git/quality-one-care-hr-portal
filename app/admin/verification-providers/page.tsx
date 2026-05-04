import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertCircle, Database, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminNav } from "@/lib/adminNav";
import { requireRole } from "@/lib/auth";
import { summarizeProviders } from "@/services/verification/externalVerifierFramework";
import { getOigDatasetMetadata } from "@/services/verification/oigService";

export default async function VerificationProvidersPage() {
  const user = await requireRole(["admin", "super_admin_hr", "executive_view_only"]);
  const providers = summarizeProviders();
  const oigMeta = await getOigDatasetMetadata();

  return (
    <DashboardShell user={user} nav={adminNav}>
      <div className="grid gap-5">
        <div>
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-orange-700">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Verification Providers</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Automated verification status</h1>
            <p className="mt-1 text-sm text-slate-600">Built-in verifiers run automatically. External providers (paid services) are enabled by setting their API keys in environment variables.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-600" /> Built-in (always on)</CardTitle></CardHeader>
          <CardContent className="pt-0 grid gap-3">
            <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-4 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-700" /> OIG LEIE (Federal Exclusions)</p>
                  <p className="mt-1 text-slate-700">Public federal dataset. Auto-downloaded daily. No API key required.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Active</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <Database size={12} />
                {oigMeta.lastUpdated ? (
                  <span>{oigMeta.recordCount.toLocaleString()} records · Last updated {oigMeta.lastUpdated.toLocaleDateString()}</span>
                ) : (
                  <span className="text-amber-700">Dataset not yet downloaded — will run on next daily job tick or manual trigger.</span>
                )}
              </div>
            </div>

            <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-4 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-700" /> Identity Cross-Validation</p>
                  <p className="mt-1 text-slate-700">Compares applicant&apos;s name, DOB, license number, license type, and address across all uploaded documents.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Active</span>
              </div>
            </div>

            <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-4 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-700" /> Credential Expiration Monitor</p>
                  <p className="mt-1 text-slate-700">Daily scan flagging expired and expiring (30 / 7 day) licenses, certifications, and verification items. Auto-creates HR alerts.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Active</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">External (paid) — plug in API key to activate</CardTitle></CardHeader>
          <CardContent className="pt-0 grid gap-3">
            {providers.map((p) => (
              <div key={p.id} className={`rounded-md border p-4 text-sm ${p.isConfigured ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50/40"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 flex items-center gap-2">
                      {p.isConfigured ? <CheckCircle2 size={14} className="text-emerald-700" /> : <AlertCircle size={14} className="text-slate-400" />}
                      {p.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Category: <span className="font-mono">{p.category}</span></p>
                    <p className="mt-1 text-xs text-slate-600">Required env vars: <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">{p.requiredEnvVars.join(", ")}</code></p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.isConfigured ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                    {p.isConfigured ? "Active" : "Not configured"}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">How to add a new external provider</CardTitle></CardHeader>
          <CardContent className="pt-0 text-sm text-slate-700">
            <ol className="list-decimal list-inside space-y-1">
              <li>Sign up for the provider&apos;s API (e.g., Nursys e-Notify, Checkr, TruDiligence).</li>
              <li>Get the API key from the provider&apos;s dashboard.</li>
              <li>Add the API key to your <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">.env</code> file.</li>
              <li>Restart the server. The provider will appear as Active.</li>
              <li>For healthcare apps: ensure your provider relationship has a signed BAA (Business Associate Agreement) before processing any real PII.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
