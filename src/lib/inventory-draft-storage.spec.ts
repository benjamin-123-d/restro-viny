import { describe, expect, it } from "vitest";

import {
  inventoryDraftKey,
  isNetworkFailure,
  mergeCounts,
  parseInventoryDraft,
  serialiseInventoryDraft,
} from "./inventory-draft-storage";

describe("inventory draft storage", () => {
  it("keys drafts per inventory", () => {
    expect(inventoryDraftKey("inv1")).toBe("restro.foodcost.inventory.inv1");
  });

  it("round-trips a draft", () => {
    const draft = { inventoryId: "inv1", counts: { l1: 12.5, l2: null }, updatedAt: 1000, pendingValidation: true };
    expect(parseInventoryDraft(serialiseInventoryDraft(draft))).toEqual(draft);
  });

  it("ignores anything malformed rather than restoring garbage", () => {
    expect(parseInventoryDraft(null)).toBeNull();
    expect(parseInventoryDraft("{not json")).toBeNull();
    expect(parseInventoryDraft(JSON.stringify({ inventoryId: "x", counts: { l1: "douze" }, updatedAt: 1 }))).toBeNull();
  });

  it("lets counts typed on the device win over what the server last saw", () => {
    const merged = mergeCounts(
      [
        { id: "l1", countedQty: 10 },
        { id: "l2", countedQty: null },
        { id: "l3", countedQty: 4 },
      ],
      { inventoryId: "inv1", counts: { l1: 12, l2: 3 }, updatedAt: 1, pendingValidation: false },
    );
    expect(merged).toEqual({ l1: 12, l2: 3, l3: 4 });
  });

  it("recognises a lost connection", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure(new Error("FOOD_INVENTORY_NOT_DRAFT"))).toBe(false);
  });
});
