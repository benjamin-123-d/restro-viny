import { describe, expect, it } from "vitest";

import {
  byService,
  computeKpis,
  dailySeries,
  daysBetween,
  findings,
  hourlyHeatmap,
  parisParts,
  paymentMix,
  percentChange,
  topItems,
  vatReport,
  type SaleTicket,
  type TicketLine,
} from "./sales-analytics";

const line = (o: Partial<TicketLine> = {}): TicketLine => ({
  name: "Poulet DG",
  quantity: 1,
  vatCategory: "FOOD",
  taxRate: 10,
  taxable: 10,
  tax: 1,
  ...o,
});

let seq = 0;
const ticket = (o: Partial<SaleTicket> = {}): SaleTicket => {
  seq += 1;
  return {
    id: `t${seq}`,
    orderNumber: seq,
    invoiceNumber: seq,
    service: "DINE_IN",
    // 12:30 in Paris, summer time.
    settledAt: new Date("2026-07-15T10:30:00Z"),
    tableLabel: null,
    grandTotal: 11,
    discountTotal: 0,
    lines: [line()],
    payments: [{ mode: "CARD", amount: 11 }],
    ...o,
  };
};

const soda = line({ name: "Limonade", vatCategory: "SOFT_DRINK", taxable: 2, tax: 0.2 });
const beer = line({ name: "Bière", vatCategory: "ALCOHOL", taxRate: 20, taxable: 5, tax: 1 });

describe("computeKpis", () => {
  it("adds HT, VAT and TTC from the lines as settled", () => {
    const k = computeKpis([ticket(), ticket({ lines: [line(), soda] })]);
    expect(k.revenueHT).toBe(22);
    expect(k.vat).toBe(2.2);
    expect(k.revenueTTC).toBe(24.2);
    expect(k.tickets).toBe(2);
    expect(k.averageTicket).toBe(12.1);
  });

  it("splits meals from drinks, alcohol included with drinks", () => {
    const k = computeKpis([ticket({ lines: [line(), soda, beer] })]);
    expect(k.foodTTC).toBe(11);
    expect(k.drinkTTC).toBe(8.2);
    expect(k.drinkShare).toBeCloseTo(42.71, 1);
  });

  it("returns zeros, not NaN, for an empty period", () => {
    const k = computeKpis([]);
    expect(k.averageTicket).toBe(0);
    expect(k.drinkShare).toBe(0);
  });
});

describe("percentChange", () => {
  it("reports growth and decline", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
  });

  it("refuses to invent a percentage from zero", () => {
    expect(percentChange(500, 0)).toBeNull();
  });
});

describe("parisParts", () => {
  it("reads the Paris day and hour, not UTC", () => {
    // 23:30 UTC on 14 July is 01:30 on 15 July in Paris (UTC+2).
    const p = parisParts(new Date("2026-07-14T23:30:00Z"));
    expect(p.day).toBe("2026-07-15");
    expect(p.hour).toBe(1);
  });

  it("numbers weekdays from Monday", () => {
    // 14 September 2026 is a Monday.
    expect(parisParts(new Date("2026-09-14T10:00:00Z")).weekday).toBe(0);
    expect(parisParts(new Date("2026-09-20T10:00:00Z")).weekday).toBe(6);
  });
});

describe("daysBetween / dailySeries", () => {
  it("lists each calendar day once, across a DST change", () => {
    // Clocks go back in France on 25 October 2026.
    const days = daysBetween(
      new Date("2026-10-24T00:00:00Z"),
      new Date("2026-10-26T20:00:00Z"),
    );
    expect(days).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });

  it("fills empty days with zeros so the chart has no gaps", () => {
    const series = dailySeries(
      [ticket({ settledAt: new Date("2026-07-15T10:00:00Z") })],
      new Date("2026-07-14T00:00:00Z"),
      new Date("2026-07-16T12:00:00Z"),
    );
    expect(series.map((d) => d.totalTTC)).toEqual([0, 11, 0]);
  });

  it("stacks meals and drinks separately per day", () => {
    const [day] = dailySeries(
      [ticket({ lines: [line(), soda] })],
      new Date("2026-07-15T00:00:00Z"),
      new Date("2026-07-15T20:00:00Z"),
    );
    expect(day.foodTTC).toBe(11);
    expect(day.drinkTTC).toBe(2.2);
  });
});

describe("byService", () => {
  it("builds the recap by way of serving, meals and drinks apart", () => {
    const rows = byService([
      ticket({ service: "DINE_IN", lines: [line(), beer] }),
      ticket({ service: "TAKEAWAY", lines: [soda] }),
    ]);
    const dineIn = rows.find((r) => r.service === "DINE_IN");
    const takeaway = rows.find((r) => r.service === "TAKEAWAY");
    expect(dineIn?.foodTTC).toBe(11);
    expect(dineIn?.drinkTTC).toBe(6);
    expect(takeaway?.drinkHT).toBe(2);
    expect(takeaway?.foodTTC).toBe(0);
  });

  it("keeps a row for a service with no sales, and drops one not offered", () => {
    const rows = byService([ticket()], ["DINE_IN", "TAKEAWAY"]);
    expect(rows.map((r) => r.service)).toEqual(["DINE_IN", "TAKEAWAY"]);
    expect(rows[1].tickets).toBe(0);
  });

  it("gives shares that add up to the whole", () => {
    const rows = byService([
      ticket({ service: "DINE_IN" }),
      ticket({ service: "TAKEAWAY" }),
      ticket({ service: "TAKEAWAY" }),
    ]);
    const total = rows.reduce((s, r) => s + r.share, 0);
    expect(total).toBeCloseTo(100, 1);
  });
});

describe("hourlyHeatmap", () => {
  it("places revenue by Paris weekday and hour", () => {
    // Wednesday 15 July 2026, 12:30 Paris.
    const heat = hourlyHeatmap([ticket()]);
    expect(heat.cells[2][12]).toBe(11);
    expect(heat.max).toBe(11);
    expect(heat.firstHour).toBe(12);
  });
});

describe("topItems", () => {
  it("ranks by revenue and sums repeat sales", () => {
    const top = topItems([
      ticket({ lines: [line(), line()] }),
      ticket({ lines: [beer] }),
    ]);
    expect(top[0]).toMatchObject({ name: "Poulet DG", quantity: 2, ttc: 22 });
    expect(top[1].name).toBe("Bière");
  });
});

describe("paymentMix", () => {
  it("totals each payment mode with its share", () => {
    const mix = paymentMix([
      ticket({ payments: [{ mode: "CARD", amount: 30 }] }),
      ticket({ payments: [{ mode: "MEAL_VOUCHER", amount: 10 }] }),
    ]);
    expect(mix[0]).toMatchObject({ mode: "CARD", amount: 30, share: 75 });
    expect(mix[1]).toMatchObject({ mode: "MEAL_VOUCHER", share: 25 });
  });
});

describe("vatReport", () => {
  it("splits collected VAT by rate for the return", () => {
    const rows = vatReport([ticket({ lines: [line(), soda, beer] })]);
    expect(rows.map((r) => r.rate)).toEqual([10, 20]);
    expect(rows[0].vat).toBe(1.2);
  });
});

describe("findings", () => {
  const window = {
    from: new Date("2026-07-13T00:00:00Z"),
    to: new Date("2026-07-19T20:00:00Z"),
  };

  it("says so plainly when nothing was sold", () => {
    const out = findings({ tickets: [], previous: [], ...window });
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain("Aucune vente");
  });

  it("reports growth against the previous period with the right direction", () => {
    const out = findings({
      tickets: [ticket(), ticket()],
      previous: [ticket()],
      ...window,
    });
    expect(out[0].tone).toBe("up");
    expect(out[0].text).toContain("hausse");
    expect(out[0].text).toContain("100");
  });

  it("does not invent a comparison when the previous period is empty", () => {
    const out = findings({ tickets: [ticket()], previous: [], ...window });
    expect(out[0].tone).toBe("info");
    expect(out[0].text).toContain("Pas de ventes sur la période précédente");
  });

  it("always ends with the VAT to declare", () => {
    const out = findings({ tickets: [ticket()], previous: [], ...window });
    expect(out[out.length - 1].text).toContain("TVA collectée");
  });

  it("mentions meal vouchers only when they were used", () => {
    const without = findings({ tickets: [ticket()], previous: [], ...window });
    expect(without.some((f) => f.text.includes("titres-restaurant"))).toBe(false);
    const withVouchers = findings({
      tickets: [ticket({ payments: [{ mode: "MEAL_VOUCHER", amount: 11 }] })],
      previous: [],
      ...window,
    });
    expect(withVouchers.some((f) => f.text.includes("titres-restaurant"))).toBe(true);
  });
});
