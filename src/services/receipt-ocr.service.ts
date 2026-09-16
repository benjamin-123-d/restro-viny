/**
 * Reads a ticket or invoice on this computer, for free and without internet:
 * the photo is straightened and contrasted with sharp, then read by Tesseract
 * with its French model shipped in node_modules. A PDF that carries text is
 * read directly. The text then goes through the receipt parser.
 */

import path from "node:path";

import sharp from "sharp";
import { createWorker, PSM, type Worker } from "tesseract.js";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";

import { parseReceiptText, type ReceiptReading } from "@/lib/receipt-parser";
import {
  cellsFromPdfItems,
  cellsFromWords,
  rowsFromCells,
  rowsToText,
  toleranceFromWords,
  type TextCell,
} from "@/lib/receipt-rows";
import { readReceiptTable } from "@/lib/receipt-table";
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
    await w.setParameters({ preserve_interword_spaces: "1" });
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

/**
 * A scanner, or a phone app, leaves the ticket in the middle of a whole blank
 * page. Reduced to 2 000 px, its print becomes too small to read — which is
 * why a scanned till receipt used to come back empty. Cutting the empty border
 * first is the whole difference between reading the ticket and reading nothing.
 */
const cropToContent = async (buffer: Buffer): Promise<Buffer> => {
  try {
    const upright = await sharp(buffer, { failOn: "none" }).rotate().toBuffer();
    const page = await sharp(upright).metadata();
    const cropped = await sharp(upright).trim({ threshold: 20 }).toBuffer({ resolveWithObject: true });
    // Refuse a crop that kept almost nothing: on a picture that is one flat
    // colour, trimming can eat the ticket itself.
    const enough =
      cropped.info.width >= 200 &&
      cropped.info.height >= 200 &&
      cropped.info.width * cropped.info.height >= (page.width ?? 0) * (page.height ?? 0) * 0.02;
    return enough ? cropped.data : upright;
  } catch {
    return buffer;
  }
};

/** Upright, grey, contrasted and about 2 000 px wide: what Tesseract reads best. */
export const prepareForOcr = async (buffer: Buffer): Promise<Buffer> =>
  sharp(await cropToContent(buffer), { failOn: "none" })
    .resize({ width: 2000, fit: "inside", withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();

interface Pass {
  readonly text: string;
  readonly confidence: number;
}

/** One reading of a picture with one page layout setting. */
const readWith = async (image: Buffer, mode: PSM): Promise<Pass> => {
  const w = await getWorker();
  await w.setParameters({ tessedit_pageseg_mode: mode });
  const { data } = await w.recognize(image, {}, { text: true, blocks: true });
  // Words come back with their boxes: rebuilding rows from those keeps a
  // right-aligned amount on the line of its label, which plain text loses.
  const words = (data.blocks ?? [])
    .flatMap((block) => block.paragraphs ?? [])
    .flatMap((paragraph) => paragraph.lines ?? [])
    .flatMap((line) => line.words ?? [])
    .filter((word) => word.text.trim() !== "")
    .map((word) => ({ text: word.text, bbox: word.bbox }));
  const text =
    words.length === 0
      ? data.text
      : rowsToText(rowsFromCells(cellsFromWords(words), toleranceFromWords(words)));
  return { text, confidence: data.confidence ?? 0 };
};

/** Tesseract is sure enough that a second attempt would only cost time. */
const CONFIDENT_ENOUGH = 82;

/**
 * How much of a reading looks like a ticket. Tesseract's own confidence says
 * how sure it is of the letters it saw, which is not the same question: on a
 * crumpled receipt the pass it trusts most is often the one that lost the
 * table. Counting the lines that parse as purchases answers the real one.
 */
const looksLikeATicket = (text: string): number => readReceiptTable(text.split("\n")).lines.length;

/**
 * A crumpled ticket and a scanned invoice do not read the same way: one is a
 * single block of text, the other a page of columns. Rather than guess, read
 * it both ways and keep the attempt that yields the most purchase lines.
 */
const ocrImage = async (buffer: Buffer): Promise<string> => {
  let prepared: Buffer;
  try {
    prepared = await prepareForOcr(buffer);
  } catch {
    throw new Error(RECEIPT_UNREADABLE);
  }
  return serially(async () => {
    try {
      const block = await readWith(prepared, PSM.SINGLE_BLOCK);
      if (block.confidence >= CONFIDENT_ENOUGH) return block.text;
      const column = await readWith(prepared, PSM.AUTO);
      const better = looksLikeATicket(column.text) - looksLikeATicket(block.text);
      if (better !== 0) return better > 0 ? column.text : block.text;
      return column.confidence > block.confidence ? column.text : block.text;
    } finally {
      scheduleRelease();
    }
  });
};

/**
 * A PDF stores its text in the order it happens to draw it, so on a columned
 * invoice a label and its amount come out far apart. Each piece does carry its
 * position, though: same height means same printed line. Rebuilding the rows
 * that way is the difference between reading the invoice and reading nothing.
 */
const pdfText = async (buffer: Buffer): Promise<string> => {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const cells: TextCell[] = [];
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const rendered = await pdf.getPage(page);
    const height = rendered.getViewport({ scale: 1 }).height;
    const content = await rendered.getTextContent();
    cells.push(
      ...cellsFromPdfItems(
        content.items as { str: string; transform: number[] }[],
        page,
        height,
      ),
    );
  }
  if (cells.length > 0) return rowsToText(rowsFromCells(cells));

  // A PDF with no positioned text at all: fall back to plain extraction.
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
};

export interface ReceiptScan {
  readonly reading: ReceiptReading;
  readonly text: string;
}

/**
 * A PDF that is only a photograph of paper — what a scanner or a phone app
 * produces. Each page is drawn at 200 dpi and read like any other picture.
 */
const scannedPdfText = async (buffer: Buffer): Promise<string> => {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pages: string[] = [];
  for (let page = 1; page <= Math.min(pdf.numPages, 8); page += 1) {
    const image = await renderPageAsImage(new Uint8Array(buffer), page, { scale: 3.4, canvasImport: () => import("@napi-rs/canvas") });
    pages.push(await ocrImage(Buffer.from(image)));
  }
  return pages.join("\n");
};

export const readReceipt = async (file: IncomingDocument): Promise<ReceiptScan> => {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  let text: string;
  if (isPdf) {
    try {
      text = await pdfText(file.buffer);
    } catch {
      throw new Error(RECEIPT_UNREADABLE);
    }
    // No text in the file: it is a scan, so read the pages as pictures.
    if (text.replace(/\s/g, "").length < 20) {
      try {
        text = await scannedPdfText(file.buffer);
      } catch {
        throw new Error(RECEIPT_PDF_SCANNED);
      }
    }
  } else {
    text = await ocrImage(file.buffer);
  }
  const reading = parseReceiptText(text);
  if (reading.totalTTC == null && reading.lines.length === 0 && !reading.date) throw new Error(RECEIPT_UNREADABLE);
  return { reading, text };
};
