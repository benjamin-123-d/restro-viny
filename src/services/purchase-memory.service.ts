/**
 * The application learning your tickets, one purchase at a time.
 *
 * The first time a « SAC DE CAISSE » is filed under emballages, that answer is
 * remembered against the wording. The next ticket from the same shop arrives
 * already classed — and, when the line was linked to an ingredient, already
 * linked. Nothing is ever forced: a correction simply replaces the memory.
 */

import { foldText } from "@/lib/search-text";
import type { PurchaseCategory } from "@/lib/purchase-categories";
import type { ReceiptLine } from "@/lib/receipt-parser";
import { prisma } from "@/lib/prisma";

export interface RememberedLine {
  readonly label: string;
  readonly code?: string | null;
  readonly category: PurchaseCategory;
  readonly stockItemId?: string | null;
}

/** The wording, stripped of sizes and codes, is the key. */
export const memoryKey = (label: string): string =>
  foldText(label)
    .replace(/\b\d+[.,]?\d*\s?(kg|g|l|cl|ml|cm|mm|x)\b/g, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

export interface MemoryHit {
  readonly category: PurchaseCategory;
  readonly stockItemId: string | null;
}

/**
 * What the restaurant already knows about these wordings. The article code
 * wins over the wording: a shop can rename « OASIS TROPICAL » but keeps 2015683.
 */
export const recallLines = async (
  restaurantId: string,
  lines: readonly { readonly label: string; readonly code?: string | null }[],
): Promise<Map<string, MemoryHit>> => {
  const keys = [...new Set(lines.map((line) => memoryKey(line.label)).filter(Boolean))];
  const codes = [...new Set(lines.map((line) => line.code).filter((code): code is string => Boolean(code)))];
  if (keys.length === 0 && codes.length === 0) return new Map();

  const rows = await prisma.purchaseLineMemory.findMany({
    where: { restaurantId, OR: [{ key: { in: keys } }, ...(codes.length > 0 ? [{ code: { in: codes } }] : [])] },
    select: { key: true, code: true, category: true, stockItemId: true },
  });

  const byKey = new Map<string, MemoryHit>();
  const byCode = new Map<string, MemoryHit>();
  for (const row of rows) {
    const hit = { category: row.category, stockItemId: row.stockItemId };
    byKey.set(row.key, hit);
    if (row.code) byCode.set(row.code, hit);
  }

  const found = new Map<string, MemoryHit>();
  for (const line of lines) {
    const hit = (line.code ? byCode.get(line.code) : undefined) ?? byKey.get(memoryKey(line.label));
    if (hit) found.set(line.label, hit);
  }
  return found;
};

/** Fills in what is already known, and says which lines that was. */
export const applyMemory = async (
  restaurantId: string,
  lines: readonly ReceiptLine[],
): Promise<ReceiptLine[]> => {
  const memory = await recallLines(restaurantId, lines);
  return lines.map((line) => {
    const hit = memory.get(line.label);
    return hit
      ? { ...line, category: hit.category, stockItemId: hit.stockItemId, learned: true }
      : line;
  });
};

/**
 * Keeps what the owner decided. Called when a purchase is saved, so the memory
 * only ever holds answers a person actually validated.
 */
export const rememberLines = async (
  restaurantId: string,
  lines: readonly RememberedLine[],
): Promise<number> => {
  const now = new Date();
  let kept = 0;
  for (const line of lines) {
    const key = memoryKey(line.label);
    if (!key) continue;
    await prisma.purchaseLineMemory.upsert({
      where: { restaurantId_key: { restaurantId, key } },
      create: {
        restaurantId,
        key,
        code: line.code ?? null,
        category: line.category,
        stockItemId: line.stockItemId ?? null,
      },
      update: {
        category: line.category,
        // A line linked to an ingredient keeps that link; an unlinked one does
        // not erase what was learned before.
        ...(line.stockItemId ? { stockItemId: line.stockItemId } : {}),
        ...(line.code ? { code: line.code } : {}),
        uses: { increment: 1 },
        lastUsedAt: now,
      },
    });
    kept += 1;
  }
  return kept;
};

/** What the restaurant has learned so far, most used first. */
export const listMemory = async (restaurantId: string, take = 200) =>
  prisma.purchaseLineMemory.findMany({
    where: { restaurantId },
    orderBy: [{ uses: "desc" }, { lastUsedAt: "desc" }],
    take,
    select: {
      id: true,
      key: true,
      code: true,
      category: true,
      uses: true,
      lastUsedAt: true,
      stockItem: { select: { id: true, name: true } },
    },
  });

export const forgetLine = (restaurantId: string, id: string) =>
  prisma.purchaseLineMemory.deleteMany({ where: { id, restaurantId } });
