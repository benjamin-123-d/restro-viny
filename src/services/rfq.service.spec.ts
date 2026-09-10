import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/rfq.repository", () => ({
  createQuotation: vi.fn(),
  createRfq: vi.fn(),
  deleteDraftQuotation: vi.fn(),
  deleteDraftRfq: vi.fn(),
  findQuotationById: vi.fn(),
  findQuotations: vi.fn(),
  findQuotationsForRfq: vi.fn(),
  findRfqById: vi.fn(),
  findRfqs: vi.fn(),
  markRfqSupplierSent: vi.fn(),
  setQuotationStatus: vi.fn(),
  setRfqStatus: vi.fn(),
  updateQuotation: vi.fn(),
  updateRfq: vi.fn(),
}));
vi.mock("@/services/purchase-order.service", () => ({
  createPurchaseOrder: vi.fn(),
}));
vi.mock("@/services/supplier.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/supplier.service")
  >("@/services/supplier.service");
  return { ...actual, loadOwnedSupplier: vi.fn() };
});

import {
  createRfq as createRfqRepo,
  findQuotationById,
  findQuotationsForRfq,
  findRfqById,
  setQuotationStatus,
  setRfqStatus,
} from "@/repositories/rfq.repository";
import { createPurchaseOrder } from "@/services/purchase-order.service";
import { loadOwnedSupplier } from "@/services/supplier.service";

import {
  compareQuotations,
  createOrderFromQuotation,
  createRfq,
  deleteRfq,
  QUOTATION_NOT_SUBMITTED,
  RFQ_NOT_DRAFT,
  RFQ_NOT_FOUND,
  submitRfq,
} from "./rfq.service";

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
} as never;

const makeRfq = (o: Record<string, unknown> = {}) =>
  ({
    id: "rfq_1",
    restaurantId: "res_1",
    number: "RFQ-00001",
    status: "DRAFT",
    transactionDate: new Date("2026-06-01T00:00:00Z"),
    requiredBy: null,
    message: null,
    termsText: null,
    items: [
      {
        id: "ri_1",
        stockItemId: "s1",
        stockItem: { id: "s1", name: "Rice", unit: "KG" },
        description: null,
        quantity: 100,
        requiredBy: null,
        sortOrder: 0,
      },
    ],
    suppliers: [],
    quotations: [],
    ...o,
  }) as never;

const quoteLine = (rfqItemId: string, rate: number, id: string) => ({
  id,
  rfqItemId,
  stockItemId: "s1",
  stockItem: { id: "s1", name: "Rice", unit: "KG" },
  description: null,
  quantity: 100,
  rate,
  discountPercent: null,
  taxRate: 0,
  amount: rate * 100,
  leadTimeDays: 2,
  sortOrder: 0,
});

const makeQuote = (
  id: string,
  supplierId: string,
  rate: number,
  o: Record<string, unknown> = {},
) =>
  ({
    id,
    restaurantId: "res_1",
    number: `SQ-0000${id.slice(-1)}`,
    status: "SUBMITTED",
    supplierId,
    supplier: { id: supplierId, name: `Supplier ${supplierId}` },
    rfqId: "rfq_1",
    rfq: { id: "rfq_1", number: "RFQ-00001" },
    transactionDate: new Date("2026-06-02T00:00:00Z"),
    validUntil: null,
    subtotal: rate * 100,
    discountAmount: 0,
    taxTotal: 0,
    grandTotal: rate * 100,
    notes: null,
    termsText: null,
    items: [quoteLine("ri_1", rate, `qi_${id}`)],
    ...o,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadOwnedSupplier).mockResolvedValue(supplier);
});

describe("createRfq", () => {
  it("checks every invited supplier accepts RFQs", async () => {
    vi.mocked(loadOwnedSupplier).mockResolvedValue({
      ...(supplier as object),
      preventRfq: true,
    } as never);

    await expect(
      createRfq(ctx, {
        items: [{ stockItemId: "s1", quantity: 10 }],
        supplierIds: ["sup_1"],
      } as never),
    ).rejects.toThrow("SUPPLIER_BLOCKED");
    expect(createRfqRepo).not.toHaveBeenCalled();
  });

  it("stores the lines in the order they were entered", async () => {
    vi.mocked(createRfqRepo).mockResolvedValue(makeRfq());

    await createRfq(ctx, {
      items: [
        { stockItemId: "s1", quantity: 10 },
        { stockItemId: "s2", quantity: 5 },
      ],
      supplierIds: ["sup_1"],
    } as never);

    const [, , , lines] = vi.mocked(createRfqRepo).mock.calls[0];
    expect(lines.map((l) => l.sortOrder)).toEqual([0, 1]);
  });
});

describe("submitRfq / deleteRfq", () => {
  it("refuses to submit an RFQ that is not a draft", async () => {
    vi.mocked(findRfqById).mockResolvedValue(makeRfq({ status: "SUBMITTED" }));

    await expect(submitRfq(ctx, { id: "rfq_1" })).rejects.toThrow(
      RFQ_NOT_DRAFT,
    );
  });

  it("submits a draft", async () => {
    vi.mocked(findRfqById).mockResolvedValue(makeRfq());
    vi.mocked(setRfqStatus).mockResolvedValue({} as never);

    await submitRfq(ctx, { id: "rfq_1" });

    expect(vi.mocked(setRfqStatus).mock.calls[0][1]).toBe("SUBMITTED");
  });

  it("refuses an RFQ from another restaurant", async () => {
    vi.mocked(findRfqById).mockResolvedValue(
      makeRfq({ restaurantId: "other" }),
    );

    await expect(deleteRfq(ctx, { id: "rfq_1" })).rejects.toThrow(
      RFQ_NOT_FOUND,
    );
  });
});

describe("compareQuotations", () => {
  it("puts each supplier's price on the same line and flags the cheapest", async () => {
    vi.mocked(findRfqById).mockResolvedValue(makeRfq({ status: "SUBMITTED" }));
    vi.mocked(findQuotationsForRfq).mockResolvedValue([
      makeQuote("q1", "sup_1", 40),
      makeQuote("q2", "sup_2", 55),
    ]);

    const comparison = await compareQuotations(ctx, "rfq_1");

    expect(comparison.suppliers).toHaveLength(2);
    const row = comparison.rows[0];
    expect(row.cells.sup_1.rate).toBe(40);
    expect(row.cells.sup_2.rate).toBe(55);
    expect(row.cells.sup_1.isBest).toBe(true);
    expect(row.cells.sup_2.isBest).toBe(false);
  });

  it("leaves a gap where a supplier did not quote the line", async () => {
    vi.mocked(findRfqById).mockResolvedValue(makeRfq({ status: "SUBMITTED" }));
    vi.mocked(findQuotationsForRfq).mockResolvedValue([
      makeQuote("q1", "sup_1", 40),
      makeQuote("q2", "sup_2", 55, { items: [] }),
    ]);

    const comparison = await compareQuotations(ctx, "rfq_1");

    expect(comparison.rows[0].cells.sup_2).toBeUndefined();
    expect(comparison.rows[0].cells.sup_1.isBest).toBe(true);
  });

  it("flags a tie on both suppliers rather than picking one", async () => {
    vi.mocked(findRfqById).mockResolvedValue(makeRfq({ status: "SUBMITTED" }));
    vi.mocked(findQuotationsForRfq).mockResolvedValue([
      makeQuote("q1", "sup_1", 40),
      makeQuote("q2", "sup_2", 40),
    ]);

    const comparison = await compareQuotations(ctx, "rfq_1");

    expect(comparison.rows[0].cells.sup_1.isBest).toBe(true);
    expect(comparison.rows[0].cells.sup_2.isBest).toBe(true);
  });

  it("returns the rows with no cells when nobody quoted", async () => {
    vi.mocked(findRfqById).mockResolvedValue(makeRfq({ status: "SUBMITTED" }));
    vi.mocked(findQuotationsForRfq).mockResolvedValue([]);

    const comparison = await compareQuotations(ctx, "rfq_1");

    expect(comparison.suppliers).toHaveLength(0);
    expect(comparison.rows[0].cells).toEqual({});
  });
});

describe("createOrderFromQuotation", () => {
  it("refuses a quotation still in draft", async () => {
    vi.mocked(findQuotationById).mockResolvedValue(
      makeQuote("q1", "sup_1", 40, { status: "DRAFT" }),
    );

    await expect(
      createOrderFromQuotation(ctx, { quotationId: "q1" }),
    ).rejects.toThrow(QUOTATION_NOT_SUBMITTED);
  });

  it("carries the quoted prices onto the order", async () => {
    vi.mocked(findQuotationById).mockResolvedValue(
      makeQuote("q1", "sup_1", 40),
    );
    vi.mocked(createPurchaseOrder).mockResolvedValue({ id: "po_1" } as never);
    vi.mocked(setQuotationStatus).mockResolvedValue({} as never);

    await createOrderFromQuotation(ctx, { quotationId: "q1" });

    const [, orderInput] = vi.mocked(createPurchaseOrder).mock.calls[0];
    expect(orderInput.supplierId).toBe("sup_1");
    expect(orderInput.items[0].rate).toBe(40);
    expect(orderInput.supplierQuotationId).toBe("q1");
  });

  it("marks the quotation fully ordered when every line is taken", async () => {
    vi.mocked(findQuotationById).mockResolvedValue(
      makeQuote("q1", "sup_1", 40),
    );
    vi.mocked(createPurchaseOrder).mockResolvedValue({ id: "po_1" } as never);
    vi.mocked(setQuotationStatus).mockResolvedValue({} as never);

    await createOrderFromQuotation(ctx, { quotationId: "q1" });

    expect(vi.mocked(setQuotationStatus).mock.calls[0][1]).toBe("ORDERED");
  });

  it("marks it partly ordered when only some lines are taken", async () => {
    vi.mocked(findQuotationById).mockResolvedValue(
      makeQuote("q1", "sup_1", 40, {
        items: [quoteLine("ri_1", 40, "qi_a"), quoteLine("ri_2", 50, "qi_b")],
      }),
    );
    vi.mocked(createPurchaseOrder).mockResolvedValue({ id: "po_1" } as never);
    vi.mocked(setQuotationStatus).mockResolvedValue({} as never);

    await createOrderFromQuotation(ctx, {
      quotationId: "q1",
      quotationItemIds: ["qi_a"],
    });

    const [, orderInput] = vi.mocked(createPurchaseOrder).mock.calls[0];
    expect(orderInput.items).toHaveLength(1);
    expect(vi.mocked(setQuotationStatus).mock.calls[0][1]).toBe(
      "PARTIALLY_ORDERED",
    );
  });

  it("rejects a line pick that matches nothing", async () => {
    vi.mocked(findQuotationById).mockResolvedValue(
      makeQuote("q1", "sup_1", 40),
    );

    await expect(
      createOrderFromQuotation(ctx, {
        quotationId: "q1",
        quotationItemIds: ["nope"],
      }),
    ).rejects.toThrow("QUOTATION_NO_LINES");
    expect(createPurchaseOrder).not.toHaveBeenCalled();
  });
});
