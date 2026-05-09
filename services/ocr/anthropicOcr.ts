// Anthropic Claude vision OCR provider for HR Application Portal.
//
// Activation: set OCR_PROVIDER=anthropic and OCR_API_KEY=sk-ant-... in
// the Railway environment. Optional OCR_ANTHROPIC_MODEL overrides the
// default model id; default is the latest vision-capable Sonnet because
// it is the cheapest model with reliable handwriting + form-structure
// understanding for HR-grade documents.
//
// Why Claude (not local Tesseract) for HR Portal:
//   - Reads handwriting, scanned forms, and damaged copies that Tesseract
//     fails on.
//   - Understands what an I-9, W-4, DEA license, or MBON nursing license
//     should contain, so it surfaces clearly when a number doesn't match
//     the expected format.
//   - Anthropic offers a HIPAA BAA — the only paid AI surface in the
//     portal that touches PHI must be on a BAA-covered provider.
//
// Cost (Sonnet 4.6, late-2025 pricing): ~$3/M input + $15/M output. A
// typical applicant with ~10 documents runs ~$0.10–$0.20 total.

import fs from "node:fs/promises";
import path from "node:path";

export type AnthropicOcrResult = {
  rawText: string;
  confidence: number;
  provider: string;
  usedFallback: boolean;
};

const MODEL_DEFAULT = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

// System prompt is constant across documents — we want clean OCR output
// without commentary, plus a short structured tail for HR-relevant
// fields when the model recognises a known document type.
const SYSTEM = `You are an OCR + structured-extraction tool for an HR onboarding system.

Read the attached document carefully and emit two sections in this exact format:

=== TEXT ===
<full literal text of the document, preserving line breaks and field labels. Do NOT paraphrase. Do NOT add commentary.>

=== STRUCTURED ===
<a JSON object capturing the HR-relevant fields you can identify with confidence. Use these keys when the document contains them: documentType, fullName, dateOfBirth, ssnLast4, address, licenseNumber, issuingAuthority, issuedDate, expirationDate, vaccinationName, vaccinationDate, employer, payRate, jobTitle. Skip keys you cannot read. Output only the JSON, no prose.>

If the document is unreadable, blank, or you cannot find any text, output:
=== TEXT ===
(empty document)
=== STRUCTURED ===
{}`;

function pickModel(): string {
  const override = process.env.OCR_ANTHROPIC_MODEL?.trim();
  return override || MODEL_DEFAULT;
}

async function callAnthropicVision(
  contentBlock: Array<Record<string, unknown>>,
  apiKey: string,
): Promise<{ text: string; tokens: { input: number; output: number } }> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const model = pickModel();
  const message = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...contentBlock,
          { type: "text", text: "Extract per the system instructions." },
        ] as unknown as Array<{ type: "text"; text: string }>,
      },
    ],
  });
  const text = message.content
    .map((block) => ("text" in block ? block.text : ""))
    .join("\n")
    .trim();
  return {
    text,
    tokens: {
      input: message.usage?.input_tokens ?? 0,
      output: message.usage?.output_tokens ?? 0,
    },
  };
}

function parseModelOutput(raw: string): { text: string; structured: string } {
  const textMatch = raw.match(/===\s*TEXT\s*===\s*([\s\S]*?)(?=\n===\s*STRUCTURED\s*===|$)/i);
  const structuredMatch = raw.match(/===\s*STRUCTURED\s*===\s*([\s\S]*?)\s*$/i);
  return {
    text: (textMatch?.[1] ?? raw).trim(),
    structured: (structuredMatch?.[1] ?? "").trim(),
  };
}

/**
 * Run OCR on a single file via Anthropic Claude vision. Returns
 * AnthropicOcrResult on success, or null when the caller should fall
 * back to local Tesseract (e.g. unsupported mime type, API error).
 */
export async function extractWithAnthropic(
  filePath: string,
  mimeType: string,
): Promise<AnthropicOcrResult | null> {
  const apiKey = process.env.OCR_API_KEY?.trim();
  const provider = process.env.OCR_PROVIDER?.trim().toLowerCase();
  if (!apiKey || provider !== "anthropic") return null;

  const ext = path.extname(filePath).toLowerCase();
  const isPdf = mimeType === "application/pdf" || ext === ".pdf";
  const isImage =
    mimeType.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);

  if (!isPdf && !isImage) {
    return null; // DOCX etc. — let local handlers parse the structured text
  }

  try {
    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString("base64");

    let contentBlock: Array<Record<string, unknown>>;
    if (isPdf) {
      // Claude supports PDFs natively in the messages API (since mid-2024).
      // Each page in the PDF counts as image-equivalent input.
      contentBlock = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        },
      ];
    } else {
      const mt = mimeType || (ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg");
      contentBlock = [
        {
          type: "image",
          source: { type: "base64", media_type: mt, data: base64 },
        },
      ];
    }

    const result = await callAnthropicVision(contentBlock, apiKey);
    const { text, structured } = parseModelOutput(result.text);

    // Append the structured extraction to rawText so downstream consumers
    // (intake wizard auto-fill, internal review) see it in one stream.
    const combined = structured
      ? `${text}\n\n=== STRUCTURED FIELDS ===\n${structured}`
      : text;

    return {
      rawText: combined,
      confidence: combined.length > 0 ? 0.95 : 0.05,
      provider: `anthropic-${pickModel()}`,
      usedFallback: combined.length === 0,
    };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[OCR] Anthropic call failed, falling back to local:", err);
    }
    return null;
  }
}
