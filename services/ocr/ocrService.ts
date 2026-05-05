import fs from "node:fs/promises";
import path from "node:path";

export type OcrResult = {
  rawText: string;
  confidence: number;
  provider: string;
  usedFallback: boolean;
};

const IMAGE_FALLBACK = "OCR could not read this document clearly. Manual review required.";
const MIN_TEXT_LENGTH = 80;

function meaningfulTextLength(text: string) {
  return text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ")
    .replace(/\bpage\s+\d+(\s+of\s+\d+)?\b/gi, " ")
    .replace(/[^a-z0-9@]/gi, "")
    .length;
}

async function recognizeImageBuffer(buffer: Buffer) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(buffer);
    return {
      text: result.data.text.trim(),
      confidence: Math.max(0, Math.min(1, (result.data.confidence || 0) / 100))
    };
  } finally {
    await worker.terminate();
  }
}

async function ocrPdfPages(filePath: string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const data = new Uint8Array(await fs.readFile(filePath));
  const loadingTask = pdfjs.getDocument({ data, disableWorker: true } as never);
  const pdf = await loadingTask.promise;
  const pagesToRead = Math.min(pdf.numPages, Number(process.env.LOCAL_OCR_MAX_PAGES ?? 12));
  const parts: string[] = [];
  const confidences: number[] = [];

  for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: Number(process.env.LOCAL_OCR_PDF_SCALE ?? 2) });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context as never, viewport } as never).promise;
    const image = canvas.toBuffer("image/png");
    const ocr = await recognizeImageBuffer(image);
    if (ocr.text) parts.push(`--- Page ${pageNumber} ---\n${ocr.text}`);
    confidences.push(ocr.confidence);
  }

  return {
    text: parts.join("\n\n").trim(),
    confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 0
  };
}

async function extractPdfTextWithPdfjs(filePath: string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await fs.readFile(filePath));
  const loadingTask = pdfjs.getDocument({ data, disableWorker: true } as never);
  const pdf = await loadingTask.promise;
  const pagesToRead = Math.min(pdf.numPages, Number(process.env.LOCAL_OCR_MAX_PAGES ?? 12));
  const parts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ")
      .trim();
    if (text) parts.push(text);
  }

  return parts.join("\n\n").trim();
}

export async function extractTextFromDocument(filePath: string, mimeType: string): Promise<OcrResult> {
  const provider = process.env.OCR_PROVIDER?.trim();
  const apiKey = process.env.OCR_API_KEY?.trim();

  if (provider && apiKey) {
    console.warn(`[OCR] Cloud provider "${provider}" configured but not yet implemented. Falling back to local OCR.`);
  }

  const ext = path.extname(filePath).toLowerCase();

  try {
    if (mimeType === "application/pdf" || ext === ".pdf") {
      let text = "";
      try {
        text = await extractPdfTextWithPdfjs(filePath);
      } catch {
        text = "";
      }
      if (text && meaningfulTextLength(text) >= MIN_TEXT_LENGTH) {
        return {
          rawText: text,
          confidence: 0.82,
          provider: "local-pdf-text",
          usedFallback: false
        };
      }
      const scanned = await ocrPdfPages(filePath);
      return {
        rawText: scanned.text || text || IMAGE_FALLBACK,
        confidence: scanned.text ? Math.max(scanned.confidence, 0.55) : text ? 0.45 : 0.1,
        provider: scanned.text ? "local-tesseract-pdf-ocr" : "local-pdf-fallback",
        usedFallback: !scanned.text
      };
    }

    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === ".docx"
    ) {
      let text = "";
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value?.trim() ?? "";
      } catch {
        text = "";
      }
      if (!text) {
        const AdmZip = (await import("adm-zip")).default;
        const zip = new AdmZip(filePath);
        const entry = zip.getEntry("word/document.xml") ?? zip.getEntries().find((item) => item.entryName.replace(/\\/g, "/") === "word/document.xml");
        const xml = entry?.getData().toString("utf8") ?? "";
        text = xml
          .replace(/<w:tab\/>/g, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
      return {
        rawText: text || IMAGE_FALLBACK,
        confidence: text ? 0.7 : 0.15,
        provider: "local-docx-fallback",
        usedFallback: true
      };
    }

    if (mimeType.startsWith("image/") || [".png", ".jpg", ".jpeg"].includes(ext)) {
      const ocr = await recognizeImageBuffer(await fs.readFile(filePath));
      return {
        rawText: ocr.text || IMAGE_FALLBACK,
        confidence: ocr.text ? Math.max(ocr.confidence, 0.5) : 0.1,
        provider: ocr.text ? "local-tesseract-image-ocr" : "local-image-fallback",
        usedFallback: !ocr.text
      };
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Local OCR failed", error);
    }
    return {
      rawText: IMAGE_FALLBACK,
      confidence: 0.1,
      provider: "local-fallback-error",
      usedFallback: true
    };
  }

  return {
    rawText: IMAGE_FALLBACK,
    confidence: 0.1,
    provider: "manual-review-fallback",
    usedFallback: true
  };
}
