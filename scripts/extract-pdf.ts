import * as fs from "fs";
import { PDFParse } from "pdf-parse";

async function main() {
  const buf = fs.readFileSync("C:/Users/honpa/Documents/Final Report page.pdf");
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  console.log("PAGES:", result.pages?.length ?? "unknown");
  console.log("===TEXT===");
  if (result.pages) {
    result.pages.forEach((p, i) => {
      console.log(`\n--- PAGE ${i + 1} ---`);
      console.log(p.text);
    });
  } else {
    console.log(result.text);
  }
}

main().catch((e) => {
  console.error("ERR:", e?.message ?? e);
  process.exit(1);
});
