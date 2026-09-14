import { describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/sales-analytics.repository", () => ({
  findMenuVatCategories: vi.fn(),
  findRestaurantSalesProfile: vi.fn(),
  findSettledOrders: vi.fn(),
}));

import type { OrderWithRelations } from "@/repositories/order.repository";

import { parisMidnight, resolvePeriod, toTicket } from "./sales-analytics.service";

describe("parisMidnight", () => {
  it("is 22:00 UTC the day before in summer (UTC+2)", () => {
    expect(parisMidnight("2026-07-15").toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });

  it("is 23:00 UTC the day before in winter (UTC+1)", () => {
    expect(parisMidnight("2026-01-15").toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });
});

describe("resolvePeriod", () => {
  // Monday 14 September 2026, 15:00 in Paris.
  const now = new Date("2026-09-14T13:00:00Z");

  it("starts « aujourd'hui » at midnight in Paris, not in UTC", () => {
    const p = resolvePeriod("jour", now);
    expect(p.from.toISOString()).toBe("2026-09-13T22:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-09-14T22:00:00.000Z");
    expect(p.previousTo.getTime()).toBe(p.from.getTime());
  });

  it("covers exactly seven Paris days for « 7 derniers jours »", () => {
    const p = resolvePeriod("7j", now);
    expect(p.from.toISOString()).toBe("2026-09-07T22:00:00.000Z");
    expect(p.to.getTime() - p.from.getTime()).toBe(7 * 86_400_000);
    expect(p.previousTo.getTime()).toBe(p.from.getTime());
  });

  it("compares a month in progress with the same stretch of last month", () => {
    const p = resolvePeriod("mois", now);
    expect(p.from.toISOString()).toBe("2026-08-31T22:00:00.000Z");
    expect(p.previousFrom.toISOString()).toBe("2026-07-31T22:00:00.000Z");
    expect(p.previousTo.getTime() - p.previousFrom.getTime()).toBe(
      p.to.getTime() - p.from.getTime(),
    );
  });

  it("takes the whole previous calendar month for « mois dernier »", () => {
    const p = resolvePeriod("mois-dernier", now);
    expect(p.from.toISOString()).toBe("2026-07-31T22:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-08-31T22:00:00.000Z");
  });

  it("wraps January back to the December of the year before", () => {
    const p = resolvePeriod("mois-dernier", new Date("2026-01-10T12:00:00Z"));
    expect(p.from.toISOString()).toBe("2025-11-30T23:00:00.000Z");
    expect(p.previousFrom.toISOString()).toBe("2025-10-31T23:00:00.000Z");
  });
});

describe("toTicket", () => {
  const order = (o: Record<string, unknown> = {}) =>
    ({
      id: "o1",
      orderNumber: 12,
      invoiceNumber: 3,
      orderType: "TAKEAWAY",
      tableLabel: null,
      settledAt: new Date("2026-09-14T11:00:00Z"),
      updatedAt: new Date("2026-09-14T11:00:00Z"),
      grandTotal: 16,
      discountTotal: 0,
      discountType: "NONE",
      discountValue: 0,
      payments: [{ mode: "MEAL_VOUCHER", amount: 16 }],
      items: [
        {
          name: "Poulet DG",
          quantity: 1,
          unitPrice: 11,
          taxRate: 10,
          taxInclusive: true,
          isComp: false,
          state: "SERVED",
          vatCategory: "FOOD",
          menuItemId: "m1",
          modifiers: [],
        },
        {
          name: "Limonade",
          quantity: 1,
          unitPrice: 5.275,
          taxRate: 5.5,
          taxInclusive: true,
          isComp: false,
          state: "VOID",
          vatCategory: "SOFT_DRINK",
          menuItemId: "m2",
          modifiers: [],
        },
        {
          name: "Bière",
          quantity: 1,
          unitPrice: 6,
          taxRate: 20,
          taxInclusive: true,
          isComp: false,
          state: "SERVED",
          vatCategory: null,
          menuItemId: "m3",
          modifiers: [],
        },
      ],
      ...o,
    }) as unknown as OrderWithRelations;

  it("backs the VAT out of TTC prices for each line", () => {
    const ticket = toTicket(order(), new Map());
    const [poulet] = ticket.lines;
    expect(poulet.taxable).toBe(10);
    expect(poulet.tax).toBe(1);
  });

  it("leaves voided lines out of the sale", () => {
    const ticket = toTicket(order(), new Map());
    expect(ticket.lines.map((l) => l.name)).toEqual(["Poulet DG", "Bière"]);
  });

  it("falls back to the menu's category for lines sold before snapshots", () => {
    const ticket = toTicket(order(), new Map([["m3", "ALCOHOL"]]));
    expect(ticket.lines[1].vatCategory).toBe("ALCOHOL");
  });

  it("keeps the payment modes as settled", () => {
    expect(toTicket(order(), new Map()).payments[0].mode).toBe("MEAL_VOUCHER");
  });
});
