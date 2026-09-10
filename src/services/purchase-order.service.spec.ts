import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/purchase-order.repository", () => ({
  createPurchaseOrder: vi.fn(),
  deleteDraftPurchaseOrder: vi.fn(),
  findPurchaseOrderById: vi.fn(),
  findPurchaseOrders: vi.fn(),
  setPurchaseOrderStatus: vi.fn(),
  updatePurchaseOrder: vi.fn(),
}));
vi.mock("@/services/supplier.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/supplier.service")
  >("@/services/supplier.service");
  return { ...actual, loadOwnedSupplier: vi.fn() };
});

import {
  createPurchaseOrder as createRepo,
  deleteDraftPurchaseOrder,
  findPurchaseOrderById,
  setPurchaseOrderStatus,
  updatePurchaseOrder as updateRepo,
} from "@/repositories/purchase-order.repository";
import { loadOwnedSupplier } from "@/services/supplier.service";

import {
  cancelPurchaseOrder,
  closePurchaseOrder,
  createPurchaseOrder,
  deletePurchaseOrder,
  holdPurchaseOrder,
  mapPurchaseOrder,
  PO_ALREADY_SUBMITTED,
  PO_NOT_DRAFT,
  PO_NOT_FOUND,
  submitPurchaseOrder,
  updatePurchaseOrder,
} from "./purchase-order.service";

const ctx = { restaurantId: "res_1", userId: "u1" };

const supplier = {
  id: "sup_1",
  restaurantId: "res_1",
  name: "Metro",
  deletedAt: null,
  onHold: false,
  holdType: null,
  releaseDate: null,
  preventRfq: false,
  preventPo: false,
  currency: null,
  paymentTermsDays: null,
} as never;

const makeOrder = (o: Record<string, unknown> = {}) =>
  ({
    id: "po_1",
    restaurantId: "res_1",
    number: "PO-00001",
    status: "DRAFT",
    supplierId: "sup_1",
    supplier: { id: "sup_1", name: "Metro" },
    supplierQuotationId: null,
    supplierQuotation: null,
    transactionDate: new Date("2026-06-01T00:00:00Z"),
    scheduleDate: null,
    currency: null,
    subtotal: 1000,
    discountAmount: 0,
    taxTotal: 0,
    roundOff: 0,
    grandTotal: 1000,
    receivedPercent: 0,
    billedPercent: 0,
    advancePaid: 0,
    notes: null,
    termsText: null,
    holdComment: null,
    items: [
      {
        id: "poi_1",
        stockItemId: "s1",
        stockItem: { id: "s1", name: "Rice", unit: "KG" },
        supplierQuotationItemId: null,
        description: null,
        quantity: 10,
        rate: 100,
        discountPercent: null,
        taxRate: 0,
        amount: 1000,
        scheduleDate: null,
        receivedQty: 0,
        billedQty: 0,
        sortOrder: 0,
      },
    ],
    ...o,
  }) as never;

const input = {
  supplierId: "sup_1",
  discountAmount: 0,
  roundTotal: false,
  items: [
    {
      stockItemId: "s1",
      quantity: 10,
      rate: 100,
      taxRate: 0,
    },
  ],
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadOwnedSupplier).mockResolvedValue(supplier);
});

describe("createPurchaseOrder", () => {
  it("prices the lines and stores the computed totals", async () => {
    vi.mocked(createRepo).mockResolvedValue(makeOrder());

    await createPurchaseOrder(ctx, input);

    const [, , data, lines] = vi.mocked(createRepo).mock.calls[0];
    expect(data.subtotal).toBe(1000);
    expect(data.grandTotal).toBe(1000);
    expect(lines[0].amount).toBe(1000);
  });

  it("applies tax and a document discount to the stored total", async () => {
    vi.mocked(createRepo).mockResolvedValue(makeOrder());

    await createPurchaseOrder(ctx, {
      ...(input as object),
      discountAmount: 100,
      items: [{ stockItemId: "s1", quantity: 10, rate: 100, taxRate: 10 }],
    } as never);

    const [, , data] = vi.mocked(createRepo).mock.calls[0];
    expect(data.subtotal).toBe(1000);
    expect(data.taxTotal).toBe(90); // 10% of 900
    expect(data.grandTotal).toBe(990);
  });

  it("refuses a supplier that is blocked for orders", async () => {
    vi.mocked(loadOwnedSupplier).mockResolvedValue({
      ...(supplier as object),
      preventPo: true,
    } as never);

    await expect(createPurchaseOrder(ctx, input)).rejects.toThrow(
      "SUPPLIER_BLOCKED",
    );
    expect(createRepo).not.toHaveBeenCalled();
  });

  it("inherits the supplier's currency", async () => {
    vi.mocked(loadOwnedSupplier).mockResolvedValue({
      ...(supplier as object),
      currency: "XOF",
    } as never);
    vi.mocked(createRepo).mockResolvedValue(makeOrder());

    await createPurchaseOrder(ctx, input);

    const [, , data] = vi.mocked(createRepo).mock.calls[0];
    expect(data.currency).toBe("XOF");
  });
});

describe("updatePurchaseOrder", () => {
  it("refuses to edit an order that is already submitted", async () => {
    vi.mocked(findPurchaseOrderById).mockResolvedValue(
      makeOrder({ status: "TO_RECEIVE_AND_BILL" }),
    );

    await expect(
      updatePurchaseOrder(ctx, { ...(input as object), id: "po_1" } as never),
    ).rejects.toThrow(PO_NOT_DRAFT);
    expect(updateRepo).not.toHaveBeenCalled();
  });

  it("edits a draft", async () => {
    vi.mocked(findPurchaseOrderById).mockResolvedValue(makeOrder());
    vi.mocked(updateRepo).mockResolvedValue(makeOrder());

    await updatePurchaseOrder(ctx, {
      ...(input as object),
      id: "po_1",
    } as never);

    expect(updateRepo).toHaveBeenCalled();
  });

  it("refuses an order belonging to another restaurant", async () => {
    vi.mocked(findPurchaseOrderById).mockResolvedValue(
      makeOrder({ restaurantId: "other" }),
    );

    await expect(
      updatePurchaseOrder(ctx, { ...(input as object), id: "po_1" } as never),
    ).rejects.toThrow(PO_NOT_FOUND);
  });
});

describe("submitPurchaseOrder", () => {
  it("moves a draft to TO_RECEIVE_AND_BILL", async () => {
    vi.mocked(findPurchaseOrderById).mockResolvedValue(makeOrder());
    vi.mocked(setPurchaseOrderStatus).mockResolvedValue({} as never);

    await submitPurchaseOrder(ctx, { id: "po_1" });

    const [, status] = vi.mocked(setPurchaseOrderStatus).mock.calls[0];
    expect(status).toBe("TO_RECEIVE_AND_BILL");
  });

  it("refuses to submit twice", async () => {
    vi.mocked(findPurchaseOrderById).mockResolvedValue(
      makeOrder({ status: "TO_RECEIVE" }),
    );

    await expect(submitPurchaseOrder(ctx, { id: "po_1" })).rejects.toThrow(
      PO_ALREADY_SUBMITTED,
    );
  });
});

describe("holdPurchaseOrder", () => {
  it("puts a live order on hold with its reason", async () => {
    vi.mocked(findPurchaseOrderById).mockResolvedValue(
      makeOrder({ status: "TO_RECEIVE_AND_BILL" }),
    );
    vi.mocked(setPurchaseOrderStatus).mockResolvedValue({} as never);

    await holdPurchaseOrder(ctx, {
      id: "po_1",
      onHold: true,
      comment: "Price dispute",
    });

    const [, status, stamps] = vi.mocked(setPurchaseOrderStatus).mock.calls[0];
    expect(status).toBe("ON_HOLD");
    expect(stamps?.holdComment).toBe("Price dispute");
  });

  it("returns a held order to its progress-derived status", async () => {
    vi.mocked(findPurchaseOrderById).mockResolvedValue(
      makeOrder({ status: "ON_HOLD", receivedPercent: 100, billedPercent: 0 }),
    );
    vi.mocked(setPurchaseOrderStatus).mockResolvedValue({} as never);

    await holdPurchaseOrder(ctx, { id: "po_1", onHold: false });

    const [, status] = vi.mocked(setPurchaseOrderStatus).mock.calls[0];
    expect(status).toBe("TO_BILL");
  });
});

describe("closePurchaseOrder / cancelPurchaseOrder", () => {
  it("closes an order that will not be completed", async () => {
    vi.mocked(findPurchaseOrderById).mockResolvedValue(
      makeOrder({ status: "TO_RECEIVE", receivedPercent: 40 }),
    );
    vi.mocked(setPurchaseOrderStatus).mockResolvedValue({} as never);

    await closePurchaseOrder(ctx, { id: "po_1" });

    expect(vi.mocked(setPurchaseOrderStatus).mock.calls[0][1]).toBe("CLOSED");
  });

  it("refuses to cancel once goods have been received", async () => {
    vi.mocked(findPurchaseOrderById).mockResolvedValue(
      makeOrder({ status: "TO_BILL", receivedPercent: 100 }),
    );

    await expect(cancelPurchaseOrder(ctx, { id: "po_1" })).rejects.toThrow(
      "PO_HAS_RECEIPTS",
    );
  });

  it("cancels an order nothing has arrived against", async () => {
    vi.mocked(findPurchaseOrderById).mockResolvedValue(
      makeOrder({ status: "TO_RECEIVE_AND_BILL" }),
    );
    vi.mocked(setPurchaseOrderStatus).mockResolvedValue({} as never);

    await cancelPurchaseOrder(ctx, { id: "po_1" });

    expect(vi.mocked(setPurchaseOrderStatus).mock.calls[0][1]).toBe("CANCELLED");
  });
});

describe("deletePurchaseOrder", () => {
  it("only deletes drafts", async () => {
    vi.mocked(findPurchaseOrderById).mockResolvedValue(
      makeOrder({ status: "TO_BILL" }),
    );

    await expect(deletePurchaseOrder(ctx, { id: "po_1" })).rejects.toThrow(
      PO_NOT_DRAFT,
    );
    expect(deleteDraftPurchaseOrder).not.toHaveBeenCalled();
  });
});

describe("mapPurchaseOrder", () => {
  it("reports what is still outstanding on each line", () => {
    const dto = mapPurchaseOrder(
      makeOrder({
        items: [
          {
            id: "poi_1",
            stockItemId: "s1",
            stockItem: { id: "s1", name: "Rice", unit: "KG" },
            supplierQuotationItemId: null,
            description: null,
            quantity: 10,
            rate: 100,
            discountPercent: null,
            taxRate: 0,
            amount: 1000,
            scheduleDate: null,
            receivedQty: 4,
            billedQty: 0,
            sortOrder: 0,
          },
        ],
      }),
    );
    expect(dto.items[0].pendingQty).toBe(6);
  });

  it("marks only drafts editable", () => {
    expect(mapPurchaseOrder(makeOrder()).isEditable).toBe(true);
    expect(
      mapPurchaseOrder(makeOrder({ status: "TO_BILL" })).isEditable,
    ).toBe(false);
  });
});
