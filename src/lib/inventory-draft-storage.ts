/**
 * An inventory is counted standing in the store room, often without signal.
 * Every figure typed is kept on the device first; the server catches up when
 * the connection comes back, and a validation asked for offline waits for it.
 * Pure helpers here, so the parsing and merging rules are tested.
 */

export interface InventoryDraft {
  readonly inventoryId: string;
  /** lineId → counted quantity (null = not counted yet). */
  readonly counts: Readonly<Record<string, number | null>>;
  readonly updatedAt: number;
  /** Validation was requested while offline. */
  readonly pendingValidation: boolean;
}

export const inventoryDraftKey = (inventoryId: string): string => `restro.foodcost.inventory.${inventoryId}`;

export const serialiseInventoryDraft = (draft: InventoryDraft): string => JSON.stringify(draft);

export const parseInventoryDraft = (raw: string | null): InventoryDraft | null => {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<InventoryDraft>;
    if (typeof data.inventoryId !== "string" || typeof data.updatedAt !== "number") return null;
    if (!data.counts || typeof data.counts !== "object") return null;
    for (const value of Object.values(data.counts)) {
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) return null;
    }
    return {
      inventoryId: data.inventoryId,
      counts: data.counts,
      updatedAt: data.updatedAt,
      pendingValidation: Boolean(data.pendingValidation),
    };
  } catch {
    return null;
  }
};

/** Server counts, overridden by anything typed on this device since. */
export const mergeCounts = (
  lines: readonly { readonly id: string; readonly countedQty: number | null }[],
  draft: InventoryDraft | null,
): Record<string, number | null> =>
  Object.fromEntries(
    lines.map((line) => [
      line.id,
      draft && line.id in draft.counts ? (draft.counts[line.id] ?? null) : line.countedQty,
    ]),
  );

/** A server action that never reached the server (offline, dropped signal). */
export const isNetworkFailure = (error: unknown): boolean =>
  error instanceof TypeError || (error instanceof Error && /fetch|network|offline/i.test(error.message));
