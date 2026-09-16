import { describe, expect, it } from "vitest";

import { marginByDay, marginByDish, marginSentence, marginTotals, purchaseResult, type SoldLine } from "./profit";

const euro = (n: number) => `${n.toLocaleString("fr-FR")} €`;

const LINES: SoldLine[] = [
  { day: "2026-09-14", menuItemId: "burger", name: "Burger", quantity: 2, revenueHT: 20, foodCost: 3 },
  { day: "2026-09-14", menuItemId: "coca", name: "Coca", quantity: 4, revenueHT: 10, foodCost: 0.8 },
  { day: "2026-09-15", menuItemId: "burger", name: "Burger", quantity: 1, revenueHT: 10, foodCost: 3 },
  // Sold without a recipe card: revenue counts, cost is unknown.
  { day: "2026-09-15", menuItemId: "plat-du-jour", name: "Plat du jour", quantity: 1, revenueHT: 12, foodCost: null },
];

describe("marginTotals", () => {
  it("subtracts only the cost of what has a known cost, and says how much is covered", () => {
    const totals = marginTotals(LINES);
    expect(totals.revenueHT).toBe(52);
    expect(totals.materialCost).toBe(12.2); // 2×3 + 4×0,80 + 1×3
    expect(totals.margin).toBe(27.8); // 40 € couverts − 12,20 €
    expect(totals.ratio).toBe(30.5);
    expect(totals.coverage).toBe(76.9);
    expect(totals.revenueWithoutCost).toBe(12);
  });

  it("stays silent rather than wrong when nothing has a card", () => {
    const totals = marginTotals([{ day: "2026-09-15", menuItemId: null, name: "Divers", quantity: 1, revenueHT: 10, foodCost: null }]);
    expect(totals.materialCost).toBe(0);
    expect(totals.margin).toBe(0);
    expect(totals.ratio).toBeNull();
    expect(totals.coverage).toBe(0);
  });

  it("handles a period without sales", () => {
    const totals = marginTotals([]);
    expect(totals).toMatchObject({ revenueHT: 0, materialCost: 0, margin: 0, ratio: null, coverage: null });
  });
});

describe("marginByDay", () => {
  it("fills the days asked for, including the empty ones", () => {
    expect(marginByDay(LINES, ["2026-09-13", "2026-09-14", "2026-09-15"])).toEqual([
      { day: "2026-09-13", revenueHT: 0, materialCost: 0, margin: 0 },
      { day: "2026-09-14", revenueHT: 30, materialCost: 9.2, margin: 20.8 },
      { day: "2026-09-15", revenueHT: 22, materialCost: 3, margin: 7 },
    ]);
  });
});

describe("marginByDish", () => {
  it("ranks dishes by the margin they brought, dishes without a card last", () => {
    const rows = marginByDish(LINES);
    expect(rows.map((r) => r.name)).toEqual(["Burger", "Coca", "Plat du jour"]);
    expect(rows[0]).toMatchObject({ quantity: 3, revenueHT: 30, materialCost: 9, margin: 21, ratio: 30, hasCost: true });
    expect(rows[2]).toMatchObject({ hasCost: false, ratio: null, margin: 0 });
  });
});

describe("purchaseResult", () => {
  it("puts revenue against everything bought, food and not", () => {
    expect(purchaseResult(1000, 300, 120)).toEqual({
      revenueHT: 1000,
      purchasesHT: 420,
      foodPurchasesHT: 300,
      otherPurchasesHT: 120,
      result: 580,
      ratio: 42,
    });
  });
});

describe("marginSentence", () => {
  it("says the figure in one sentence", () => {
    expect(marginSentence(marginTotals(LINES), euro)).toBe(
      "Tu as vendu 52 € HT · la matière t'a coûté 12,2 € · il te reste 27,8 € · ratio matière 30,5 %",
    );
  });

  it("warns instead of pretending when no dish has a card", () => {
    const totals = marginTotals([{ day: "d", menuItemId: null, name: "x", quantity: 1, revenueHT: 10, foodCost: null }]);
    expect(marginSentence(totals, euro)).toContain("Aucun plat vendu n'a de fiche technique");
  });

  it("says nothing happened when nothing was sold", () => {
    expect(marginSentence(marginTotals([]), euro)).toBe("Aucune vente sur la période.");
  });
});
