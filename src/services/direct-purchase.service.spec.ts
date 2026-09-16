import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/direct-purchase.repository", () => ({
  findDirectPurchases: vi.fn(),
  findIngredientPurchasesOfInvoice: vi.fn(),
  findInvoiceExpenseLines: vi.fn(),
  findPurchasingMode: vi.fn(),
  findSpendingInPeriod: vi.fn(),
  findSupplierByNameInsensitive: vi.fn(),
  replaceExpenseLines: vi.fn(),
  updatePurchasingMode: vi.fn(),
}));
vi.mock("@/repositories/food-cost.repository", () => ({ findIngredients: vi.fn() }));
vi.mock("@/repositories/purchase-invoice.repository", () => ({
  createPurchaseInvoice: vi.fn(),
  findPurchaseInvoiceById: vi.fn(),
}));
vi.mock("@/services/food-cost.service", () => ({ recordPurchase: vi.fn() }));
vi.mock("@/services/purchase-invoice.service", () => ({ submitPurchaseInvoice: vi.fn() }));
vi.mock("@/services/supplier-documents.service", () => ({ attachPurchaseDocument: vi.fn() }));
vi.mock("@/services/supplier-payment.service", () => ({ createSupplierPayment: vi.fn() }));
vi.mock("@/services/supplier.service", () => ({
  assertSupplierAccepts: vi.fn(),
  createSupplier: vi.fn(),
  loadOwnedSupplier: vi.fn(),
}));

import type { DirectPurchaseInput } from "@/lib/validators/direct-purchase";
import {
  findSpendingInPeriod,
  findSupplierByNameInsensitive,
  replaceExpenseLines,
} from "@/repositories/direct-purchase.repository";
import { findIngredients } from "@/repositories/food-cost.repository";
import { createPurchaseInvoice, findPurchaseInvoiceById } from "@/repositories/purchase-invoice.repository";
import { recordPurchase } from "@/services/food-cost.service";
import { submitPurchaseInvoice } from "@/services/purchase-invoice.service";
import { attachPurchaseDocument } from "@/services/supplier-documents.service";
import { createSupplierPayment } from "@/services/supplier-payment.service";
import { createSupplier, loadOwnedSupplier } from "@/services/supplier.service";

import {
  BREAKDOWN_MISMATCH,
  DIRECT_PURCHASE_ITEM_INVALID,
  getSpendingBreakdown,
  recordDirectPurchase,
  setInvoiceBreakdown,
} from "./direct-purchase.service";

const ctx = { restaurantId: "r1", userId: "u1" };
const shop = { id: "s1", name: "Metro Nanterre", currency: "EUR" };

// 40 € HT food at 5,5 % + 10 € HT cleaning at 20 % = 54,20 € TTC.
const ticket = (overrides: Partial<DirectPurchaseInput> = {}): DirectPurchaseInput => ({
  supplierName: "metro nanterre",
  purchasedAt: new Date("2026-09-15T10:00:00Z"),
  ticketNumber: "T-0042",
  paymentMode: "CARD",
  alreadyPaid: true,
  totalTTC: 54.2,
  expenseLines: [
    { category: "DENREES", label: undefined, amountHT: 40, vatRate: 5.5 },
    { category: "ENTRETIEN", label: "Javel", amountHT: 10, vatRate: 20 },
  ],
  ingredientLines: [{ stockItemId: "tomato", quantity: 2, amount: 14 }],
  notes: undefined,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findSupplierByNameInsensitive).mockResolvedValue({ id: "s1", name: "Metro Nanterre" });
  vi.mocked(loadOwnedSupplier).mockResolvedValue(shop as never);
  vi.mocked(findIngredients).mockResolvedValue([{ id: "tomato", isPreparation: false }] as never);
  vi.mocked(createPurchaseInvoice).mockResolvedValue({ id: "inv1", number: "PINV-00012" } as never);
});

describe("recordDirectPurchase", () => {
  it("records the paid ticket, its breakdown, the detailed ingredients and the photo", async () => {
    const photo = { buffer: Buffer.from("jpg"), type: "image/jpeg", size: 3, name: "ticket.jpg" };

    const result = await recordDirectPurchase(ctx, ticket({ source: "PHOTO" }), photo);

    expect(result).toEqual({ id: "inv1", number: "PINV-00012" });
    const [, , invoice, lines, schedule] = vi.mocked(createPurchaseInvoice).mock.calls[0];
    expect(invoice).toMatchObject({
      isDirectPurchase: true,
      summaryOnly: true,
      paymentMode: "CARD",
      supplierId: "s1",
      supplierInvoiceNo: "T-0042",
      subtotal: 50,
      taxTotal: 4.2,
      grandTotal: 54.2,
      roundOff: 0,
    });
    expect(invoice.expenseLines).toEqual([
      { category: "DENREES", label: null, amountHT: 40, vatRate: 5.5, vatAmount: 2.2 },
      { category: "ENTRETIEN", label: "Javel", amountHT: 10, vatRate: 20, vatAmount: 2 },
    ]);
    expect(lines).toEqual([]);
    expect(schedule).toHaveLength(1);
    expect(submitPurchaseInvoice).toHaveBeenCalledWith(ctx, { id: "inv1" });
    expect(createSupplierPayment).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ amount: 54.2, mode: "CARD", allocations: [{ purchaseInvoiceId: "inv1", amount: 54.2 }] }),
    );
    expect(recordPurchase).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ stockItemId: "tomato", quantity: 2, amount: 14 }),
      { purchaseInvoiceId: "inv1" },
    );
    expect(attachPurchaseDocument).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: "INVOICE", parentId: "inv1", source: "PHOTO" }));
  });

  it("finds a known shop whatever its capitals instead of creating it again", async () => {
    await recordDirectPurchase(ctx, ticket());
    expect(createSupplier).not.toHaveBeenCalled();
  });

  it("creates a shop typed for the first time", async () => {
    vi.mocked(findSupplierByNameInsensitive).mockResolvedValue(null);
    vi.mocked(createSupplier).mockResolvedValue({ id: "s2" } as never);
    await recordDirectPurchase(ctx, ticket({ supplierName: "Marché de Rungis" }));
    expect(createSupplier).toHaveBeenCalledWith(ctx, expect.objectContaining({ name: "Marché de Rungis" }));
    expect(loadOwnedSupplier).toHaveBeenCalledWith("r1", "s2");
  });

  it("leaves the invoice to pay when it was not paid on the spot", async () => {
    await recordDirectPurchase(ctx, ticket({ alreadyPaid: false }));
    expect(createSupplierPayment).not.toHaveBeenCalled();
  });

  it("refuses a breakdown that does not add up, before writing anything", async () => {
    await expect(recordDirectPurchase(ctx, ticket({ totalTTC: 70 }))).rejects.toThrow(BREAKDOWN_MISMATCH);
    expect(createPurchaseInvoice).not.toHaveBeenCalled();
    expect(recordPurchase).not.toHaveBeenCalled();
  });

  it("refuses an ingredient from another restaurant or a preparation", async () => {
    vi.mocked(findIngredients).mockResolvedValue([{ id: "tomato", isPreparation: true }] as never);
    await expect(recordDirectPurchase(ctx, ticket())).rejects.toThrow(DIRECT_PURCHASE_ITEM_INVALID);
    expect(createPurchaseInvoice).not.toHaveBeenCalled();
  });
});

describe("setInvoiceBreakdown", () => {
  beforeEach(() => {
    vi.mocked(findPurchaseInvoiceById).mockResolvedValue({ id: "inv9", restaurantId: "r1", grandTotal: 120 } as never);
  });

  it("shares out an invoice when the parts add up to its total", async () => {
    await setInvoiceBreakdown(ctx, {
      purchaseInvoiceId: "inv9",
      expenseLines: [{ category: "MATERIEL", label: undefined, amountHT: 100, vatRate: 20 }],
    });
    expect(replaceExpenseLines).toHaveBeenCalledWith("r1", "inv9", [
      { category: "MATERIEL", label: null, amountHT: 100, vatRate: 20, vatAmount: 20 },
    ]);
  });

  it("refuses parts that do not add up", async () => {
    await expect(
      setInvoiceBreakdown(ctx, { purchaseInvoiceId: "inv9", expenseLines: [{ category: "MATERIEL", label: undefined, amountHT: 90, vatRate: 20 }] }),
    ).rejects.toThrow(BREAKDOWN_MISMATCH);
    expect(replaceExpenseLines).not.toHaveBeenCalled();
  });
});

describe("getSpendingBreakdown", () => {
  it("adds up breakdowns, counts detailed invoices as goods and flags totals left unsplit", async () => {
    vi.mocked(findSpendingInPeriod).mockResolvedValue([
      { id: "a", subtotal: 50, summaryOnly: true, isDirectPurchase: true, expenseLines: [{ category: "DENREES", amountHT: 40 }, { category: "ENTRETIEN", amountHT: 10 }] },
      { id: "b", subtotal: 100, summaryOnly: false, isDirectPurchase: false, expenseLines: [] },
      { id: "c", subtotal: 50, summaryOnly: true, isDirectPurchase: false, expenseLines: [] },
    ] as never);

    const result = await getSpendingBreakdown(ctx, new Date("2026-09-01"), new Date("2026-10-01"));

    expect(result.totalHT).toBe(200);
    expect(result.rows).toEqual([
      { bucket: "DENREES", amountHT: 140, share: 0.7 },
      { bucket: "NON_VENTILE", amountHT: 50, share: 0.25 },
      { bucket: "ENTRETIEN", amountHT: 10, share: 0.05 },
    ]);
    expect(result.foodShare).toBe(0.7);
    expect(result.unsplitInvoiceCount).toBe(1);
  });
});
