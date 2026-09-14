import { describe, expect, it } from "vitest";

import {
  effectiveVatCategory,
  formatVatRate,
  FRENCH_VAT_RATES,
  isDrink,
  RATES_TO_CONFIRM,
  ratesInUse,
  resolveFrenchVatRate,
  VAT_RATES_BY_TERRITORY,
  vatBreakdown,
  vatRatesFor,
} from "./french-vat";

describe("resolveFrenchVatRate", () => {
  it("charges 10 % on a meal whatever the service", () => {
    expect(resolveFrenchVatRate("FOOD", "DINE_IN")).toBe(10);
    expect(resolveFrenchVatRate("FOOD", "TAKEAWAY")).toBe(10);
    expect(resolveFrenchVatRate("FOOD", "DELIVERY")).toBe(10);
  });

  it("drops a soft drink to 5,5 % once it leaves the premises", () => {
    expect(resolveFrenchVatRate("SOFT_DRINK", "DINE_IN")).toBe(10);
    expect(resolveFrenchVatRate("SOFT_DRINK", "TAKEAWAY")).toBe(5.5);
    expect(resolveFrenchVatRate("SOFT_DRINK", "DELIVERY")).toBe(5.5);
  });

  it("charges alcohol at 20 % everywhere", () => {
    expect(resolveFrenchVatRate("ALCOHOL", "DINE_IN")).toBe(20);
    expect(resolveFrenchVatRate("ALCOHOL", "TAKEAWAY")).toBe(20);
    expect(resolveFrenchVatRate("ALCOHOL", "DELIVERY")).toBe(20);
  });

  it("only ever uses rates that exist in French law for restaurants", () => {
    const legal = new Set([5.5, 10, 20]);
    for (const byService of Object.values(FRENCH_VAT_RATES)) {
      for (const rate of Object.values(byService)) {
        expect(legal.has(rate)).toBe(true);
      }
    }
  });
});

describe("effectiveVatCategory", () => {
  it("inherits the menu section's category by default", () => {
    expect(effectiveVatCategory(null, "SOFT_DRINK")).toBe("SOFT_DRINK");
  });

  it("lets an item override its section — a wine inside « Boissons »", () => {
    expect(effectiveVatCategory("ALCOHOL", "SOFT_DRINK")).toBe("ALCOHOL");
  });
});

describe("isDrink", () => {
  it("groups both kinds of drink apart from meals", () => {
    expect(isDrink("SOFT_DRINK")).toBe(true);
    expect(isDrink("ALCOHOL")).toBe(true);
    expect(isDrink("FOOD")).toBe(false);
  });
});

describe("vatBreakdown", () => {
  it("splits a mixed ticket by rate, lowest first", () => {
    const rows = vatBreakdown([
      { taxRate: 20, taxable: 5, tax: 1 },
      { taxRate: 10, taxable: 20, tax: 2 },
      { taxRate: 10, taxable: 10, tax: 1 },
    ]);
    expect(rows).toEqual([
      { rate: 10, baseHT: 30, vat: 3, totalTTC: 33 },
      { rate: 20, baseHT: 5, vat: 1, totalTTC: 6 },
    ]);
  });

  it("keeps 5,5 % as its own row rather than rounding it", () => {
    const rows = vatBreakdown([
      { taxRate: 5.5, taxable: 2.84, tax: 0.16 },
      { taxRate: 10, taxable: 9.09, tax: 0.91 },
    ]);
    expect(rows.map((r) => r.rate)).toEqual([5.5, 10]);
  });

  it("leaves out rates with nothing on them", () => {
    expect(vatBreakdown([{ taxRate: 10, taxable: 0, tax: 0 }])).toEqual([]);
  });

  it("keeps money at the cent", () => {
    const [row] = vatBreakdown([
      { taxRate: 10, taxable: 0.1, tax: 0.01 },
      { taxRate: 10, taxable: 0.2, tax: 0.02 },
    ]);
    expect(row.baseHT).toBe(0.3);
    expect(row.totalTTC).toBe(0.33);
  });
});

describe("formatVatRate", () => {
  it("writes rates the French way", () => {
    expect(formatVatRate(5.5).replace(/\s/g, " ")).toBe("5,5 %");
    expect(formatVatRate(10).replace(/\s/g, " ")).toBe("10 %");
  });
});

describe("VAT by territory", () => {
  it("taxes Corsican alcohol at 10 % on the premises, 20 % taken away", () => {
    expect(resolveFrenchVatRate("ALCOHOL", "DINE_IN", "CORSE")).toBe(10);
    expect(resolveFrenchVatRate("ALCOHOL", "TAKEAWAY", "CORSE")).toBe(20);
  });

  it("applies art. 296 in Guadeloupe, Martinique and La Réunion", () => {
    for (const territory of ["GUADELOUPE", "MARTINIQUE", "REUNION"] as const) {
      expect(resolveFrenchVatRate("FOOD", "DINE_IN", territory)).toBe(2.1);
      expect(resolveFrenchVatRate("SOFT_DRINK", "TAKEAWAY", territory)).toBe(2.1);
      expect(resolveFrenchVatRate("ALCOHOL", "DINE_IN", territory)).toBe(8.5);
    }
  });

  it("charges no VAT in Guyane and Mayotte (art. 294)", () => {
    for (const territory of ["GUYANE", "MAYOTTE"] as const) {
      for (const category of ["FOOD", "SOFT_DRINK", "ALCOHOL"] as const) {
        expect(resolveFrenchVatRate(category, "DINE_IN", territory)).toBe(0);
      }
    }
  });

  it("defaults to continental France when no territory is given", () => {
    expect(resolveFrenchVatRate("SOFT_DRINK", "TAKEAWAY")).toBe(5.5);
  });

  it("lists each territory's rates once, lowest first", () => {
    expect(ratesInUse("METROPOLE")).toEqual([5.5, 10, 20]);
    expect(ratesInUse("REUNION")).toEqual([2.1, 8.5]);
    expect(ratesInUse("GUYANE")).toEqual([0]);
  });

  it("only ever flags cells that exist in the table", () => {
    for (const cell of RATES_TO_CONFIRM) {
      expect(vatRatesFor(cell.territory)[cell.category][cell.service]).toBeTypeOf(
        "number",
      );
      expect(cell.note.length).toBeGreaterThan(20);
    }
  });

  it("uses only legal French rates in every territory", () => {
    const legal = new Set([0, 2.1, 5.5, 8.5, 10, 20]);
    for (const table of Object.values(VAT_RATES_BY_TERRITORY)) {
      for (const byService of Object.values(table)) {
        for (const rate of Object.values(byService)) {
          expect(legal.has(rate)).toBe(true);
        }
      }
    }
  });
});
