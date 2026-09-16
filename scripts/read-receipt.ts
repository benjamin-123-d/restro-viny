import { readFile } from "node:fs/promises";
import path from "node:path";

import { readReceipt } from "../src/services/receipt-ocr.service";

/**
 * Reads a ticket photo or PDF the way « Lire le ticket » does, and prints the
 * raw text next to what was understood — to tune the parser on real tickets.
 *
 *   npx tsx scripts/read-receipt.ts ticket.jpg [--text]
 */

const file = process.argv[2];
if (!file) {
  console.error("Usage : npx tsx scripts/read-receipt.ts <photo ou pdf> [--text]");
  process.exit(1);
}

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

const main = async () => {
  const buffer = await readFile(file);
  const started = Date.now();
  const { reading, text } = await readReceipt({
    buffer,
    size: buffer.length,
    name: path.basename(file),
    type: TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
  });
  if (process.argv.includes("--text")) console.log(`--- texte lu ---\n${text}\n----------------`);
  console.log(JSON.stringify(reading, null, 2));
  console.log(`Lu en ${Date.now() - started} ms`);
  process.exit(0);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
