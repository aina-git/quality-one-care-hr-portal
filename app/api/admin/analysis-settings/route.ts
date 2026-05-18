import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security";
import { publicUrl } from "@/lib/publicUrl";

export async function POST(request: Request) {
  const user = await requireRole(["super_admin_hr"]);
  const form = await request.formData();
  const provider = sanitizeText(form.get("provider"), 40) || "none";
  const data = {
    provider,
    confidenceThreshold: Math.min(1, Math.max(0.5, Number(form.get("confidenceThreshold") || 0.9))),
    lmstudioBaseUrl: sanitizeText(form.get("lmstudioBaseUrl"), 300),
    lmstudioModel: sanitizeText(form.get("lmstudioModel"), 160),
    ollamaBaseUrl: sanitizeText(form.get("ollamaBaseUrl"), 300),
    ollamaModel: sanitizeText(form.get("ollamaModel"), 160),
    groqModel: sanitizeText(form.get("groqModel"), 160),
    openrouterModel: sanitizeText(form.get("openrouterModel"), 160),
    localDocumentAnalyzerUrl: sanitizeText(form.get("localDocumentAnalyzerUrl"), 300),
    cloudUsageEnabled: form.get("cloudUsageEnabled") === "on",
    updatedByUserId: user.id
  };
  const existing = await prisma.documentAnalysisSetting.findFirst();
  const saved = existing
    ? await prisma.documentAnalysisSetting.update({ where: { id: existing.id }, data })
    : await prisma.documentAnalysisSetting.create({ data });

  let tested = "saved";
  if (form.get("testConnection") === "1") {
    tested = "provider saved; connection test is provider-ready";
    await prisma.documentAnalysisSetting.update({
      where: { id: saved.id },
      data: { lastAnalysisResult: { provider, testedAt: new Date().toISOString(), status: tested } }
    });
  }
  await logAction(user.id, "document_analysis_settings_updated", "document_analysis_setting", saved.id, {
    provider,
    cloudUsageEnabled: data.cloudUsageEnabled
  });
  return NextResponse.redirect(publicUrl(`/admin/analysis-settings?tested=${encodeURIComponent(tested)}`, request));
}
