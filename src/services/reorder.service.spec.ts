import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/stock.repository", () => ({ findStockItemsByRestaurant: vi.fn() }));
vi.mock("@/services/supplier.service", () => ({ listSuppliers: vi.fn() }));
vi.mock("@/services/purchase-order.service", () => ({ createPurchaseOrder: vi.fn() }));

import { findStockItemsByRestaurant } from "@/repositories/stock.repository";
import { createPurchaseOrder } from "@/services/purchase-order.service";
import { listSuppliers } from "@/services/supplier.service";

import { createReorderOrders, listReorderSuggestions, suggestReorderQuantity } from "./reorder.service";

const ctx = { restaurantId: "r1", userId: "u1" };

describe("suggestReorderQuantity", () => {
  it("refills up to the par level", () => {
    expect(suggestReorderQuantity({ onHand: 3, reorderLevel: 5, parLevel: 20 })).toBe(17);
  });

  it("without a par level, aims for twice the reorder level", () => {
    expect(suggestReorderQuantity({ onHand: 2, reorderLevel: 5, parLevel: null })).toBe(8);
  });

  it("covers a negative on-hand as well", () => {
    expect(suggestReorderQuantity({ onHand: -4, reorderLevel: 5, parLevel: 10 })).toBe(14);
  });

  it("always orders something for an item at its threshold", () => {
    expect(suggestReorderQuantity({ onHand: 10, reorderLevel: 10, parLevel: 10 })).toBe(10);
  });
});

const item = (o: Record<string, unknown>) => ({
  id: "i1",
  name: "Tomates",
  unit: "KG",
  onHand: 2,
  reorderLevel: 5,
  parLevel: 12,
  costPerUnit: 2.3,
  defaultSupplierId: "s1",
  isActive: true,
  ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listSuppliers).mockResolvedValue([
    { id: "s1", name: "Primeurs Lyonnais", disabled: false, preventPo: false },
    { id: "s2", name: "Boucherie Guillot", disabled: false, preventPo: false },
  ] as never);
});

describe("listReorderSuggestions", () => {
  it("lists only items at or under their reorder level, with their usual supplier", async () => {
    vi.mocked(findStockItemsByRestaurant).mockResolvedValue([
      item({}),
      item({ id: "i2", name: "Riz", onHand: 50, reorderLevel: 10 }),
    ] as never);
    const lines = await listReorderSuggestions(ctx);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ stockItemId: "i1", suggestedQty: 10, supplierName: "Primeurs Lyonnais" });
  });
});

describe("createReorderOrders", () => {
  it("raises one draft order per supplier and reports items without one", async () => {
    vi.mocked(findStockItemsByRestaurant).mockResolvedValue([
      item({}),
      item({ id: "i2", name: "Poulet", defaultSupplierId: "s2", costPerUnit: 6.2 }),
      item({ id: "i3", name: "Oignons", defaultSupplierId: null }),
    ] as never);
    vi.mocked(createPurchaseOrder).mockImplementation(async (_ctx, input) => ({ id: `po-${input.supplierId}`, number: "PO-1" }) as never);

    const result = await createReorderOrders(ctx, {
      lines: [
        { stockItemId: "i1", quantity: 10 },
        { stockItemId: "i2", quantity: 8 },
        { stockItemId: "i3", quantity: 5 },
      ],
    });

    expect(createPurchaseOrder).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createPurchaseOrder).mock.calls[0][1]).toMatchObject({
      supplierId: "s1",
      items: [expect.objectContaining({ stockItemId: "i1", quantity: 10, rate: 2.3 })],
    });
    expect(result.orders.map((o) => o.supplierName)).toEqual(["Primeurs Lyonnais", "Boucherie Guillot"]);
    expect(result.skipped).toEqual(["Oignons"]);
  });
});
