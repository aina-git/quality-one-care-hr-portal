import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAnalysisSettings, isCloudProvider } from "@/services/analysis/documentAnalysisProvider";

export default async function AnalysisSettingsPage({ searchParams }: { searchParams: Promise<{ tested?: string }> }) {
  const user = await requireRole(["admin", "super_admin_hr"]);
  const params = await searchParams;
  const settings = await getAnalysisSettings();
  const stored = await prisma.documentAnalysisSetting.findFirst({ orderBy: { updatedAt: "desc" } });
  const cloudWarning = isCloudProvider(settings.provider);

  return (
    <DashboardShell
      user={user}
      nav={[
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/admin/system-health", label: "System Health" },
        { href: "/admin/analysis-settings", label: "Analysis Settings" },
        { href: "/hr/log-review", label: "Log Review" }
      ]}
    >
      <div className="grid gap-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-orange-600">Document Analysis Governance</p>
          <h1 className="mt-2 text-3xl font-semibold">Machine Learning provider settings</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Default provider is none. Local providers are preferred for sensitive healthcare employment documents. Cloud usage must be explicitly enabled.
          </p>
        </section>
        {cloudWarning ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
            Cloud provider selected. Never send documents externally unless authorized and cloud usage is explicitly enabled.
          </div>
        ) : null}
        {params.tested ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Connection test recorded: {params.tested}</div> : null}
        <Card>
          <CardHeader><CardTitle>Provider Configuration</CardTitle></CardHeader>
          <CardContent>
            <form action="/api/admin/analysis-settings" method="post" className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Provider
                <select name="provider" defaultValue={settings.provider} className="h-10 rounded-md border bg-white px-3">
                  {["none", "lmstudio", "ollama", "groq", "openrouter"].map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Confidence threshold
                <input name="confidenceThreshold" defaultValue={settings.confidenceThreshold} type="number" min="0.5" max="1" step="0.01" className="h-10 rounded-md border bg-white px-3" />
              </label>
              <label className="grid gap-1 text-sm">
                LM Studio base URL
                <input name="lmstudioBaseUrl" defaultValue={settings.lmstudioBaseUrl} className="h-10 rounded-md border bg-white px-3" />
              </label>
              <label className="grid gap-1 text-sm">
                LM Studio model
                <input name="lmstudioModel" defaultValue={settings.lmstudioModel} className="h-10 rounded-md border bg-white px-3" />
              </label>
              <label className="grid gap-1 text-sm">
                Ollama base URL
                <input name="ollamaBaseUrl" defaultValue={settings.ollamaBaseUrl} className="h-10 rounded-md border bg-white px-3" />
              </label>
              <label className="grid gap-1 text-sm">
                Ollama model
                <input name="ollamaModel" defaultValue={settings.ollamaModel} className="h-10 rounded-md border bg-white px-3" />
              </label>
              <label className="grid gap-1 text-sm">
                Groq model
                <input name="groqModel" defaultValue={settings.groqModel} className="h-10 rounded-md border bg-white px-3" />
              </label>
              <label className="grid gap-1 text-sm">
                OpenRouter model
                <input name="openrouterModel" defaultValue={settings.openrouterModel} className="h-10 rounded-md border bg-white px-3" />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                Local document analyzer URL
                <input name="localDocumentAnalyzerUrl" defaultValue={settings.localDocumentAnalyzerUrl} className="h-10 rounded-md border bg-white px-3" />
              </label>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input name="cloudUsageEnabled" type="checkbox" defaultChecked={settings.cloudUsageEnabled} />
                Enable cloud provider usage for document analysis
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button type="submit">Save Settings</Button>
                <Button name="testConnection" value="1" type="submit" variant="outline">Test Connection</Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Last Analysis Result</CardTitle></CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(stored?.lastAnalysisResult ?? settings.lastAnalysisResult ?? {}, null, 2)}</pre>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
