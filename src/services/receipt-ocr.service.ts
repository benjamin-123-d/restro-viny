/**
 * Reads a ticket or invoice on this computer, for free and without internet:
 * the photo is straightened and contrasted with sharp, then read by Tesseract
 * with its French model shipped in node_modules. A PDF that carries text is
 * read directly. The text then goes through the receipt parser.
 */

import path from "node:path";

import sharp from "sharp";
import { createWorker, PSM, type Worker } from "tesseract.js";
import { extractText, getDocumentProxy } from "unpdf";

import { parseReceiptText, type ReceiptReading } from "@/lib/receipt-parser";
import type { IncomingDocument } from "@/services/supplier-documents.service";

export const RECEIPT_UNREADABLE = "RECEIPT_UNREADABLE";
export const RECEIPT_PDF_SCANNED = "RECEIPT_PDF_SCANNED";

const LANG_PATH = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "fra", "4.0.0_best_int");
const IDLE_MS = 120_000;

let worker: Promise<Worker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let queue: Promise<unknown> = Promise.resolve();

/**
 * One warm worker, loaded on first use and let go after two idle minutes. A
 * single text block keeps right-aligned amounts on the line of their label.
 */
const getWorker = (): Promise<Worker> => {
  worker ??= (async () => {
    const w = await createWorker("fra", 1, { langPath: LANG_PATH, cacheMethod: "none", gzip: true });
    await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
    return w;
  })().catch((error) => {
    worker = null;
    throw error;
  });
  return worker;
};

const scheduleRelease = () => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const current = worker;
    worker = null;
    void current?.then((w) => w.terminate()).catch(() => undefined);
  }, IDLE_MS);
  idleTimer.unref?.();
};

/** Tesseract reads one page at a time; later requests wait their turn. */
const serially = <T>(job: () => Promise<T>): Promise<T> => {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
};

/** Upright, grey, contrasted and about 2 000 px wide: what Tesseract reads best. */
export const prepareForOcr = async (buffer: Buffer): Promise<Buffer> =>
  sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 2000, fit: "inside", withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();

const ocrImage = async (buffer: Buffer): Promise<string> => {
  let prepared: Buffer;
  try {
    prepared = await prepareForOcr(buffer);
  } catch {
    throw new Error(RECEIPT_UNREADABLE);
  }
  return serially(async () => {
    const w = await getWorker();
    try {
      const { data } = await w.recognize(prepared);
      return data.text;
    } finally {
      scheduleRelease();
    }
  });
};

const pdfText = async (buffer: Buffer): Promise<string> => {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
};

export interface ReceiptScan {
  readonly reading: ReceiptReading;
  readonly text: string;
}

export const readReceipt = async (file: IncomingDocument): Promise<ReceiptScan> => {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  let text: string;
  if (isPdf) {
    try {
      text = await pdfText(file.buffer);
    } catch {
      throw new Error(RECEIPT_UNREADABLE);
    }
    if (text.replace(/\s/g, "").length < 20) throw new Error(RECEIPT_PDF_SCANNED);
  } else {
    text = await ocrImage(file.buffer);
  }
  const reading = parseReceiptText(text);
  if (reading.totalTTC == null && reading.lines.length === 0 && !reading.date) throw new Error(RECEIPT_UNREADABLE);
  return { reading, text };
};
