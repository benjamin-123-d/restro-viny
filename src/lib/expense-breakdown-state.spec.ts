import { describe, expect, it } from "vitest";

import { emptyBreakdown, parseAmount, remainderToType, splitTTC, toExpenseLines } from "./expense-breakdown-state";
import { breakdownMatches } from "./purchase-categories";

describe("splitTTC", () => {
  it("gives back the TTC amount exactly once HT and VAT are rounded", () => {
    const { amountHT, vatAmount } = splitTTC(12.99, 5.5);
    expect(amountHT).toBe(12.31);
    expect(vatAmount).toBe(0.68);
    expect(amountHT + vatAmount).toBeCloseTo(12.99, 10);
  });
});

describe("parseAmount", () => {
  it("reads French amounts", () => {
    expect(parseAmount("1 234,50 €")).toBe(1234.5);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("abc")).toBe(0);
  });
});

describe("toExpenseLines", () => {
  it("puts the whole ticket in one category when nothing else was bought", () => {
    const lines = toExpenseLines({ ...emptyBreakdown(), mixed: false }, 63.3);
    expect(lines).toEqual([{ category: "DENREES", vatRate: 5.5, amountHT: 60, vatAmount: 3.3 }]);
    expect(breakdownMatches(lines, 63.3)).toBe(true);
  });

  it("waits for a total before proposing anything", () => {
    expect(toExpenseLines({ ...emptyBreakdown(), mixed: false }, undefined)).toEqual([]);
  });

  it("reads TTC prices from a shop ticket, row by row", () => {
    const lines = toExpenseLines(
      {
        ...emptyBreakdown(),
        mixed: true,
        rows: [
          { key: "a", category: "DENREES", label: "", amount: "42,20", vatRate: 5.5 },
          { key: "b", category: "ENTRETIEN", label: " Javel ", amount: "12", vatRate: 20 },
          { key: "c", category: "MATERIEL", label: "", amount: "", vatRate: 20 },
        ],
      },
      54.2,
    );
    expect(lines).toEqual([
      { category: "DENREES", vatRate: 5.5, label: undefined, amountHT: 40, vatAmount: 2.2 },
      { category: "ENTRETIEN", vatRate: 20, label: "Javel", amountHT: 10, vatAmount: 2 },
    ]);
    expect(breakdownMatches(lines, 54.2)).toBe(true);
  });

  it("reads HT amounts from a supplier invoice", () => {
    const lines = toExpenseLines(
      {
        ...emptyBreakdown(),
        mixed: true,
        amountsAre: "HT",
        rows: [{ key: "a", category: "MATERIEL", label: "Poêle", amount: "25", vatRate: 20 }],
      },
      30,
    );
    expect(lines).toEqual([{ category: "MATERIEL", vatRate: 20, label: "Poêle", amountHT: 25, vatAmount: 5 }]);
  });
});

describe("remainderToType", () => {
  it("proposes the missing amount in the unit being typed", () => {
    expect(remainderToType(12, "TTC", 20)).toBe(12);
    expect(remainderToType(12, "HT", 20)).toBe(10);
  });
});
