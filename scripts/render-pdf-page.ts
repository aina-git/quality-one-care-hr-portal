import * as fs from "fs";
import * as path from "path";
import { createCanvas } from "@napi-rs/canvas";
// pdfjs-dist legacy build is the Node-friendly entrypoint
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const inputPath = process.argv[2] ?? "C:/Users/honpa/Documents/Final Report page.pdf";
  const pageNum = Number.parseInt(process.argv[3] ?? "2", 10);
  const outPath = process.argv[4] ?? "C:/tmp/final-report-page.png";

  const data = fs.readFileSync(inputPath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
  console.log(`PDF has ${doc.numPages} pages. Rendering page ${pageNum}...`);

  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 }); // 2x for clarity
  const canvas = createCanvas(viewport.width, viewport.height) as unknown as { getContext: (t: string) => unknown; toBuffer: (t: string) => Buffer };
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context as never,
    viewport
  } as never).promise;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
  console.log(`Saved page ${pageNum} to ${outPath}`);
}

main().catch((e) => {
  console.error("ERR:", e?.message ?? e);
  process.exit(1);
});
