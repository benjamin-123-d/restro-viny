import { describe, expect, it } from "vitest";

import {
  computePurchaseTotals,
  derivePurchaseInvoiceStatus,
  derivePurchaseOrderStatus,
  derivePurchaseReceiptStatus,
  percentOf,
  type PurchaseLineInput,
} from "./purchase-totals";

const line = (o: Partial<PurchaseLineInput> = {}): PurchaseLineInput => ({
  quantity: 1,
  rate: 100,
  discountPercent: null,
  taxRate: 0,
  ...o,
});

describe("computePurchaseTotals", () => {
  it("multiplies quantity by rate for a plain line", () => {
    const t = computePurchaseTotals([line({ quantity: 3, rate: 250 })]);
    expect(t.lines[0].gross).toBe(750);
    expect(t.lines[0].net).toBe(750);
    expect(t.subtotal).toBe(750);
    expect(t.grandTotal).toBe(750);
  });

  it("applies a line discount percentage before tax", () => {
    const t = computePurchaseTotals([
      line({ quantity: 2, rate: 100, discountPercent: 10, taxRate: 18 }),
    ]);
    expect(t.lines[0].gross).toBe(200);
    expect(t.lines[0].discount).toBe(20);
    expect(t.lines[0].net).toBe(180);
    expect(t.lines[0].tax).toBe(32.4);
    expect(t.lines[0].total).toBe(212.4);
  });

  it("sums tax per line, so mixed rates stay correct", () => {
    const t = computePurchaseTotals([
      line({ quantity: 1, rate: 100, taxRate: 5 }),
      line({ quantity: 1, rate: 100, taxRate: 18 }),
    ]);
    expect(t.taxTotal).toBe(23);
    expect(t.subtotal).toBe(200);
    expect(t.grandTotal).toBe(223);
  });

  it("spreads a document-level discount across lines, pro rata to net", () => {
    const t = computePurchaseTotals(
      [
        line({ quantity: 1, rate: 300, taxRate: 10 }),
        line({ quantity: 1, rate: 100, taxRate: 10 }),
      ],
      { documentDiscount: 40 },
    );
    // 40 split 3:1 → 30 off the first line, 10 off the second.
    expect(t.documentDiscount).toBe(40);
    expect(t.taxTotal).toBe(36); // 10% of (270 + 90)
    expect(t.grandTotal).toBe(396);
  });

  it("never lets a document discount push a total below zero", () => {
    const t = computePurchaseTotals([line({ rate: 100 })], {
      documentDiscount: 500,
    });
    expect(t.grandTotal).toBe(0);
    expect(t.documentDiscount).toBe(100);
  });

  it("rounds the grand total and reports the rounding adjustment", () => {
    const t = computePurchaseTotals([line({ quantity: 3, rate: 33.33 })], {
      roundTotal: true,
    });
    expect(t.subtotal).toBe(99.99);
    expect(t.roundOff).toBe(0.01);
    expect(t.grandTotal).toBe(100);
  });

  it("returns zeroed totals for an empty document", () => {
    const t = computePurchaseTotals([]);
    expect(t.subtotal).toBe(0);
    expect(t.grandTotal).toBe(0);
    expect(t.lines).toHaveLength(0);
  });

  it("keeps money at two decimals", () => {
    const t = computePurchaseTotals([
      line({ quantity: 3, rate: 10.005, taxRate: 7.5 }),
    ]);
    expect(t.subtotal).toBe(30.02);
    expect(t.grandTotal).toBe(Number(t.grandTotal.toFixed(2)));
  });
});

describe("percentOf", () => {
  it("reports completion as a percentage", () => {
    expect(percentOf(5, 10)).toBe(50);
    expect(percentOf(10, 10)).toBe(100);
  });

  it("treats an over-receipt as fully complete, not more than complete", () => {
    expect(percentOf(12, 10)).toBe(100);
  });

  it("is zero when nothing was ordered", () => {
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe("derivePurchaseOrderStatus", () => {
  it("keeps explicit lifecycle states ahead of progress", () => {
    const p = { receivedPercent: 100, billedPercent: 100 };
    expect(derivePurchaseOrderStatus({ ...p, state: "DRAFT" })).toBe("DRAFT");
    expect(derivePurchaseOrderStatus({ ...p, state: "CANCELLED" })).toBe(
      "CANCELLED",
    );
    expect(derivePurchaseOrderStatus({ ...p, state: "CLOSED" })).toBe("CLOSED");
    expect(derivePurchaseOrderStatus({ ...p, state: "ON_HOLD" })).toBe(
      "ON_HOLD",
    );
  });

  it("walks the ERPNext ladder as goods and bills arrive", () => {
    const s = (receivedPercent: number, billedPercent: number) =>
      derivePurchaseOrderStatus({
        state: "SUBMITTED",
        receivedPercent,
        billedPercent,
      });
    expect(s(0, 0)).toBe("TO_RECEIVE_AND_BILL");
    expect(s(50, 0)).toBe("TO_RECEIVE_AND_BILL");
    expect(s(100, 0)).toBe("TO_BILL");
    expect(s(0, 100)).toBe("TO_RECEIVE");
    expect(s(100, 100)).toBe("COMPLETED");
  });
});

describe("derivePurchaseReceiptStatus", () => {
  it("tracks how much of the receipt has been billed", () => {
    const s = (billedPercent: number) =>
      derivePurchaseReceiptStatus({ state: "SUBMITTED", billedPercent });
    expect(s(0)).toBe("TO_BILL");
    expect(s(40)).toBe("PARTLY_BILLED");
    expect(s(100)).toBe("COMPLETED");
  });

  it("keeps drafts, returns and cancellations as they are", () => {
    expect(
      derivePurchaseReceiptStatus({ state: "DRAFT", billedPercent: 0 }),
    ).toBe("DRAFT");
    expect(
      derivePurchaseReceiptStatus({ state: "CANCELLED", billedPercent: 0 }),
    ).toBe("CANCELLED");
    expect(
      derivePurchaseReceiptStatus({ state: "RETURN", billedPercent: 0 }),
    ).toBe("RETURN");
  });
});

describe("derivePurchaseInvoiceStatus", () => {
  const due = new Date("2026-03-10T00:00:00Z");
  const before = new Date("2026-03-01T00:00:00Z");
  const after = new Date("2026-03-20T00:00:00Z");

  it("is PAID once the outstanding amount is cleared", () => {
    expect(
      derivePurchaseInvoiceStatus({
        state: "SUBMITTED",
        grandTotal: 1000,
        paidAmount: 1000,
        dueDate: due,
        now: after,
      }),
    ).toBe("PAID");
  });

  it("is PARTLY_PAID while something has been paid but not all", () => {
    expect(
      derivePurchaseInvoiceStatus({
        state: "SUBMITTED",
        grandTotal: 1000,
        paidAmount: 400,
        dueDate: due,
        now: before,
      }),
    ).toBe("PARTLY_PAID");
  });

  it("is UNPAID before the due date and OVERDUE after it", () => {
    const base = {
      state: "SUBMITTED" as const,
      grandTotal: 1000,
      paidAmount: 0,
      dueDate: due,
    };
    expect(derivePurchaseInvoiceStatus({ ...base, now: before })).toBe("UNPAID");
    expect(derivePurchaseInvoiceStatus({ ...base, now: after })).toBe("OVERDUE");
  });

  it("does not mark a fully paid invoice overdue", () => {
    expect(
      derivePurchaseInvoiceStatus({
        state: "SUBMITTED",
        grandTotal: 500,
        paidAmount: 500,
        dueDate: due,
        now: after,
      }),
    ).toBe("PAID");
  });

  it("keeps drafts, returns and cancellations as they are", () => {
    const base = {
      grandTotal: 100,
      paidAmount: 0,
      dueDate: due,
      now: after,
    };
    expect(derivePurchaseInvoiceStatus({ ...base, state: "DRAFT" })).toBe(
      "DRAFT",
    );
    expect(derivePurchaseInvoiceStatus({ ...base, state: "CANCELLED" })).toBe(
      "CANCELLED",
    );
    expect(derivePurchaseInvoiceStatus({ ...base, state: "RETURN" })).toBe(
      "RETURN",
    );
  });

  it("tolerates rounding dust when deciding an invoice is settled", () => {
    expect(
      derivePurchaseInvoiceStatus({
        state: "SUBMITTED",
        grandTotal: 1000,
        paidAmount: 999.995,
        dueDate: due,
        now: after,
      }),
    ).toBe("PAID");
  });
});
