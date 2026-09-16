/**
 * What the kitchen and the room declare from their phones, and what the
 * manager does with it.
 *
 * The rule that holds everything: staff declare, they do not correct. A cook
 * who finds 3 kg where the app expected 5 signals the gap; the stock only
 * moves once the manager applies it. Otherwise a shortage can be erased by
 * retyping it, and the inventory stops meaning anything.
 */

import { buildCostBook } from "@/services/food-cost-pricing.service";
import type { BreakageInput, StockCheckInput } from "@/lib/validators/staff-declarations";
import { findIngredients } from "@/repositories/food-cost.repository";
import {
  applyStockCheckLines,
  countPendingChecks,
  createBreakage,
  createStockCheck,
  dismissStockCheck as dismissRepo,
  findBreakages,
  findStockCheckById,
  findStockChecks,
} from "@/repositories/staff-declarations.repository";
import type { StaffContext } from "@/lib/staff-auth";
import type { StockUnit } from "@/types/inventory";

export const STOCK_CHECK_NOT_FOUND = "STOCK_CHECK_NOT_FOUND";
export const STOCK_CHECK_ALREADY_RESOLVED = "STOCK_CHECK_ALREADY_RESOLVED";

const num = (v: unknown): number => Number(v ?? 0);
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export interface StaffStockRow {
  readonly stockItemId: string;
  readonly name: string;
  readonly unit: StockUnit;
  readonly storageLocation: string | null;
  readonly onHand: number;
  readonly isLow: boolean;
}

/** What the kitchen should find this morning, in the order of the shelves. */
export const getStaffStock = async (restaurantId: string): Promise<StaffStockRow[]> => {
  const rows = await findIngredients(restaurantId);
  return rows
    .filter((row) => row.isActive && !row.isPreparation)
    .map((row) => ({
      stockItemId: row.id,
      name: row.name,
      unit: row.unit as StockUnit,
      storageLocation: row.storageLocation,
      onHand: num(row.onHand),
      isLow: row.reorderLevel != null && num(row.onHand) <= num(row.reorderLevel),
    }))
    .sort(
      (a, b) =>
        (a.storageLocation ?? "zzz").localeCompare(b.storageLocation ?? "zzz", "fr") ||
        a.name.localeCompare(b.name, "fr"),
    );
};

/**
 * Records what the cook typed. Nothing moves: the lines that differ from the
 * expected quantity become a gap for the manager to look at.
 */
export const submitStockCheck = async (ctx: StaffContext, input: StockCheckInput): Promise<{ id: string }> => {
  const rows = await findIngredients(ctx.restaurantId);
  const costOf = buildCostBook(rows);
  const byId = new Map(rows.map((row) => [row.id, row]));

  const lines = input.lines
    .filter((line) => byId.has(line.stockItemId))
    .map((line) => {
      const item = byId.get(line.stockItemId);
      const theoretical = round3(num(item?.onHand));
      const counted = round3(line.countedQty);
      return {
        stockItemId: line.stockItemId,
        theoreticalQty: theoretical,
        // « Vu, c'est bon » is stored as null: there is nothing to apply.
        countedQty: counted === theoretical ? null : counted,
        unitCost: costOf(line.stockItemId) ?? null,
      };
    });

  return createStockCheck({ restaurantId: ctx.restaurantId, staffId: ctx.staffId, note: input.note ?? null, lines });
};

export interface StockCheckLineDTO {
  readonly id: string;
  readonly name: string;
  readonly unit: StockUnit;
  readonly storageLocation: string | null;
  readonly theoreticalQty: number;
  readonly countedQty: number | null;
  readonly gap: number;
  readonly gapValue: number;
}

export interface StockCheckDTO {
  readonly id: string;
  readonly checkedAt: string;
  readonly status: "EN_ATTENTE" | "APPLIQUE" | "REFUSE";
  readonly staffName: string;
  readonly note: string | null;
  readonly resolvedAt: string | null;
  readonly lines: readonly StockCheckLineDTO[];
  /** Lines the cook actually changed — the ones worth looking at. */
  readonly gapCount: number;
  readonly gapValue: number;
};

const toCheckDTO = (row: Awaited<ReturnType<typeof findStockChecks>>[number]): StockCheckDTO => {
  const lines = row.lines.map((line) => {
    const theoretical = num(line.theoreticalQty);
    const counted = line.countedQty == null ? null : num(line.countedQty);
    const gap = counted == null ? 0 : round3(counted - theoretical);
    return {
      id: line.id,
      name: line.stockItem.name,
      unit: line.stockItem.unit as StockUnit,
      storageLocation: line.stockItem.storageLocation,
      theoreticalQty: theoretical,
      countedQty: counted,
      gap,
      gapValue: round2(gap * num(line.unitCost)),
    };
  });
  const gaps = lines.filter((line) => line.countedQty != null);
  return {
    id: row.id,
    checkedAt: row.checkedAt.toISOString(),
    status: row.status,
    staffName: row.staff.name,
    note: row.note,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    lines,
    gapCount: gaps.length,
    gapValue: round2(gaps.reduce((sum, line) => sum + line.gapValue, 0)),
  };
};

export const listStockChecks = async (
  restaurantId: string,
  status?: "EN_ATTENTE" | "APPLIQUE" | "REFUSE",
): Promise<StockCheckDTO[]> => (await findStockChecks(restaurantId, status)).map(toCheckDTO);

export const countStockChecksToReview = (restaurantId: string): Promise<number> => countPendingChecks(restaurantId);

/** The manager accepts the kitchen's figures: now, and only now, stock moves. */
export const applyStockCheck = async (
  ctx: { restaurantId: string; userId: string },
  id: string,
): Promise<void> => {
  const check = await findStockCheckById(id);
  if (!check || check.restaurantId !== ctx.restaurantId) throw new Error(STOCK_CHECK_NOT_FOUND);
  if (check.status !== "EN_ATTENTE") throw new Error(STOCK_CHECK_ALREADY_RESOLVED);
  await applyStockCheckLines({
    checkId: check.id,
    restaurantId: ctx.restaurantId,
    userId: ctx.userId,
    staffId: check.staff.id,
    lines: check.lines
      .filter((line) => line.countedQty != null)
      .map((line) => ({
        stockItemId: line.stockItem.id,
        countedQty: num(line.countedQty),
        unitCost: line.unitCost == null ? null : num(line.unitCost),
      })),
  });
};

export const dismissStockCheck = async (ctx: { restaurantId: string; userId: string }, id: string): Promise<void> => {
  const check = await findStockCheckById(id);
  if (!check || check.restaurantId !== ctx.restaurantId) throw new Error(STOCK_CHECK_NOT_FOUND);
  if (check.status !== "EN_ATTENTE") throw new Error(STOCK_CHECK_ALREADY_RESOLVED);
  await dismissRepo(id, ctx.userId);
};

// ------------------------------------------------------------- breakages ---

export interface BreakageDTO {
  readonly id: string;
  readonly brokeAt: string;
  readonly label: string;
  readonly quantity: number;
  readonly unitValue: number | null;
  readonly value: number;
  readonly reason: string | null;
  readonly note: string | null;
  readonly declaredBy: string | null;
}

/**
 * A broken glass is not food: it is recorded here, valued, and deliberately
 * kept out of the food cost so the material ratio stays honest.
 */
export const recordBreakage = async (
  ctx: { restaurantId: string; staffId?: string },
  input: BreakageInput,
): Promise<{ id: string }> =>
  createBreakage({
    restaurantId: ctx.restaurantId,
    staffId: ctx.staffId ?? null,
    label: input.label,
    quantity: input.quantity,
    unitValue: input.unitValue ?? null,
    value: round2((input.unitValue ?? 0) * input.quantity),
    reason: input.reason ?? null,
    note: input.note ?? null,
    brokeAt: new Date(),
  });

export const listBreakages = async (restaurantId: string, from?: Date, to?: Date): Promise<BreakageDTO[]> =>
  (await findBreakages(restaurantId, from, to)).map((row) => ({
    id: row.id,
    brokeAt: row.brokeAt.toISOString(),
    label: row.label,
    quantity: num(row.quantity),
    unitValue: row.unitValue == null ? null : num(row.unitValue),
    value: num(row.value),
    reason: row.reason,
    note: row.note,
    declaredBy: row.staff?.name ?? null,
  }));
