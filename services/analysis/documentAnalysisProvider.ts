import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export type AnalysisField = {
  key: string;
  label?: string;
  value?: string;
  confidence?: number;
  reason?: string;
};

export type DocumentAnalysisResult = {
  document_type: string;
  extracted_fields: AnalysisField[];
  confidence_by_field: Record<string, number>;
  unclear_fields: Array<{ field: string; reason: string; extracted_value?: string }>;
  mismatch_warnings: Array<{ field: string; reason: string; expected?: string; found?: string }>;
  recommended_next_action: string;
  provider: string;
  externalTransmission: boolean;
};

const cloudProviders = new Set(["groq", "openrouter"]);

export async function getAnalysisSettings() {
  const stored = await prisma.documentAnalysisSetting.findFirst({ orderBy: { updatedAt: "desc" } });
  return {
    provider: process.env.DOCUMENT_ANALYSIS_PROVIDER || stored?.provider || "none",
    confidenceThreshold: Number(process.env.DOCUMENT_ANALYSIS_CONFIDENCE_THRESHOLD || stored?.confidenceThreshold || 0.9),
    lmstudioBaseUrl: process.env.LMSTUDIO_BASE_URL || stored?.lmstudioBaseUrl || "http://localhost:1234/v1",
    lmstudioModel: process.env.LMSTUDIO_MODEL || stored?.lmstudioModel || "",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || stored?.ollamaBaseUrl || "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL || stored?.ollamaModel || "",
    groqModel: process.env.GROQ_MODEL || stored?.groqModel || "",
    openrouterModel: process.env.OPENROUTER_MODEL || stored?.openrouterModel || "",
    localDocumentAnalyzerUrl: process.env.LOCAL_DOCUMENT_ANALYZER_URL || stored?.localDocumentAnalyzerUrl || "http://localhost:8000/analyze",
    cloudUsageEnabled: stored?.cloudUsageEnabled ?? false,
    lastAnalysisResult: stored?.lastAnalysisResult ?? null
  };
}

export function isCloudProvider(provider: string) {
  return cloudProviders.has(provider);
}

export async function analyzeDocumentWithProvider({
  documentId,
  rawText,
  fallbackDocumentType,
  userId
}: {
  documentId: string;
  rawText: string;
  fallbackDocumentType: string;
  userId: string;
}): Promise<DocumentAnalysisResult> {
  const settings = await getAnalysisSettings();
  const provider = settings.provider || "none";
  await logAction(userId, "document_analysis_started", "uploaded_document", documentId, { provider });

  if (provider === "none") {
    const result: DocumentAnalysisResult = {
      document_type: fallbackDocumentType,
      extracted_fields: [],
      confidence_by_field: {},
      unclear_fields: [],
      mismatch_warnings: [],
      recommended_next_action: "Manual review. Document analysis provider is set to none.",
      provider,
      externalTransmission: false
    };
    await prisma.documentAnalysisSetting.updateMany({ data: { lastAnalysisResult: result } });
    await logAction(userId, "document_analysis_completed", "uploaded_document", documentId, { provider, mode: "none" });
    return result;
  }

  if (isCloudProvider(provider) && !settings.cloudUsageEnabled) {
    const result: DocumentAnalysisResult = {
      document_type: fallbackDocumentType,
      extracted_fields: [],
      confidence_by_field: {},
      unclear_fields: [{ field: "document", reason: "Cloud provider is configured but cloud usage is not enabled." }],
      mismatch_warnings: [],
      recommended_next_action: "Manual review. Enable cloud usage explicitly before external analysis.",
      provider,
      externalTransmission: false
    };
    await logAction(userId, "document_analysis_failed", "uploaded_document", documentId, { provider, reason: "cloud_usage_disabled" });
    return result;
  }

  if (isCloudProvider(provider)) {
    await logAction(userId, "cloud_provider_used", "uploaded_document", documentId, { provider });
  }

  try {
    if (provider === "local") {
      const response = await fetch(settings.localDocumentAnalyzerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText, instruction: "Structure OCR output only. Never invent missing values." })
      });
      if (!response.ok) throw new Error(`Local analyzer unavailable: ${response.status}`);
      const payload = await response.json();
      const result = normalizeProviderResult(payload, provider, isCloudProvider(provider));
      await prisma.documentAnalysisSetting.updateMany({ data: { lastAnalysisResult: result } });
      await logAction(userId, "document_analysis_completed", "uploaded_document", documentId, { provider });
      return result;
    }
  } catch (error) {
    await logAction(userId, "document_analysis_failed", "uploaded_document", documentId, {
      provider,
      reason: error instanceof Error ? error.message : "analysis_failed"
    });
  }

  const result: DocumentAnalysisResult = {
    document_type: fallbackDocumentType,
    extracted_fields: [],
    confidence_by_field: {},
    unclear_fields: [{ field: "document", reason: "Analysis pending. Provider unavailable or not implemented for local runtime." }],
    mismatch_warnings: [],
    recommended_next_action: "Manual review. Keep original document visible and verify all fields.",
    provider,
    externalTransmission: isCloudProvider(provider)
  };
  await prisma.documentAnalysisSetting.updateMany({ data: { lastAnalysisResult: result } });
  return result;
}

function normalizeProviderResult(payload: Record<string, unknown>, provider: string, externalTransmission: boolean): DocumentAnalysisResult {
  return {
    document_type: String(payload.document_type || "other"),
    extracted_fields: Array.isArray(payload.extracted_fields) ? (payload.extracted_fields as AnalysisField[]) : [],
    confidence_by_field: typeof payload.confidence_by_field === "object" && payload.confidence_by_field ? payload.confidence_by_field as Record<string, number> : {},
    unclear_fields: Array.isArray(payload.unclear_fields) ? payload.unclear_fields as DocumentAnalysisResult["unclear_fields"] : [],
    mismatch_warnings: Array.isArray(payload.mismatch_warnings) ? payload.mismatch_warnings as DocumentAnalysisResult["mismatch_warnings"] : [],
    recommended_next_action: String(payload.recommended_next_action || "Manual review required."),
    provider,
    externalTransmission
  };
}
