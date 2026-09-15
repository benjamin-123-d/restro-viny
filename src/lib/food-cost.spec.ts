import { describe, expect, it } from "vitest";

import {
  dishEconomics,
  dishSentence,
  foodCostReport,
  grossUnitCost,
  netUsageCost,
  preparationUnitCost,
  realConsumption,
  recipeCost,
  theoreticalConsumption,
  topDishesByMargin,
  varianceCauses,
  varianceHeadline,
  type SoldDish,
} from "./food-cost";

// The worked example of the specification, in euros: a 8 000 g basket of
// tomatoes bought 3,50 €, 90 % usable.
const TOMATO = { purchasePrice: 3.5, purchaseFactor: 8000, yieldPercent: 90 };

describe("netUsageCost", () => {
  it("divides the price by the pack size, then by the yield", () => {
    // (3,50 ÷ 8 000) ÷ 0,90
    expect(netUsageCost(TOMATO)).toBeCloseTo(0.000486111, 9);
  });

  it("applies the yield even when it is 100 %", () => {
    expect(netUsageCost({ ...TOMATO, yieldPercent: 100 })).toBeCloseTo(0.0004375, 9);
  });

  it("has no cost without a price", () => {
    expect(netUsageCost({ ...TOMATO, purchasePrice: null })).toBeNull();
  });

  it("refuses a zero pack size or yield rather than dividing by zero", () => {
    expect(netUsageCost({ ...TOMATO, purchaseFactor: 0 })).toBeNull();
    expect(netUsageCost({ ...TOMATO, yieldPercent: 0 })).toBeNull();
  });
});

describe("grossUnitCost", () => {
  it("is the price of one usage unit before yield", () => {
    expect(grossUnitCost(3.5, 8000)).toBeCloseTo(0.0004375, 9);
  });
});

describe("recipeCost", () => {
  it("adds gross quantity × net usage cost, per the specification", () => {
    const cost = recipeCost(
      [
        { quantity: 2000, netCost: netUsageCost(TOMATO) },
        { quantity: 1500, netCost: 0.0021 },
      ],
      10,
    );
    // 2 000 × 0,000486111 + 1 500 × 0,0021 = 0,972222 + 3,15 = 4,122222
    expect(cost.total).toBeCloseTo(4.122222, 5);
    expect(cost.perPortion).toBeCloseTo(0.412222, 5);
    expect(cost.complete).toBe(true);
  });

  it("flags a card whose ingredients are not all priced", () => {
    const cost = recipeCost([{ quantity: 100, netCost: 0.01 }, { quantity: 50, netCost: null }], 1);
    expect(cost.complete).toBe(false);
    expect(cost.unpricedLines).toBe(1);
    expect(cost.total).toBeCloseTo(1, 9);
  });

  it("treats fewer than one portion as one", () => {
    expect(recipeCost([{ quantity: 10, netCost: 1 }], 0).perPortion).toBe(10);
  });
});

describe("dishEconomics / dishSentence", () => {
  it("gives cost, price, margin and ratio on the HT price", () => {
    const d = dishEconomics(2.4, 9.09);
    expect(d.margin).toBeCloseTo(6.69, 2);
    expect(d.ratio).toBeCloseTo(26.4, 1);
  });

  it("has no ratio without a selling price", () => {
    expect(dishEconomics(2.4, 0).ratio).toBeNull();
  });

  it("speaks plainly, as the specification words it", () => {
    expect(dishSentence(dishEconomics(2.4, 9.09))).toBe(
      "Te coûte 2,40 € · Tu vends 9,09 € HT · Tu gagnes 6,69 € · Ratio 26 %",
    );
  });
});

describe("preparationUnitCost", () => {
  it("spreads the batch cost over what the preparation yields", () => {
    // 2 000 g of tomatoes at 0,0005 €/g make 1 000 ml of sauce.
    expect(preparationUnitCost([{ quantity: 2000, netCost: 0.0005 }], 1000, 100)).toBeCloseTo(0.001, 9);
  });

  it("has no cost without a yield quantity", () => {
    expect(preparationUnitCost([{ quantity: 2000, netCost: 0.0005 }], null, 100)).toBeNull();
  });
});

describe("theoreticalConsumption", () => {
  const sales: SoldDish[] = [
    { menuItemId: "riz", name: "Riz au gras", quantity: 10, revenueHT: 90, foodCost: 2.5 },
    { menuItemId: "cafe", name: "Café", quantity: 20, revenueHT: 30, foodCost: null },
  ];

  it("multiplies what was sold by the cost frozen on each sale", () => {
    const t = theoreticalConsumption(sales);
    expect(t.value).toBe(25);
  });

  it("measures how much revenue comes from dishes without a card", () => {
    const t = theoreticalConsumption(sales);
    expect(t.uncoveredRevenueHT).toBe(30);
    expect(t.uncoveredShare).toBe(25);
  });
});

describe("realConsumption", () => {
  it("is opening stock plus entries minus closing stock, valued", () => {
    const r = realConsumption({
      start: [{ stockItemId: "t", quantity: 10000, unitCost: 0.0005 }],
      entries: [{ stockItemId: "t", quantity: 8000, unitCost: 0.0005 }],
      end: [{ stockItemId: "t", quantity: 6000, unitCost: 0.0005 }],
    });
    expect(r.startValue).toBe(5);
    expect(r.entriesValue).toBe(4);
    expect(r.endValue).toBe(3);
    expect(r.value).toBe(6);
  });
});

describe("foodCostReport", () => {
  const c = netUsageCost(TOMATO) ?? 0;

  it("finds no variance when sales explain every gram", () => {
    // 50 plates of 200 g gross: 10 000 g consumed.
    const report = foodCostReport({
      start: [{ stockItemId: "t", quantity: 10000, unitCost: c }],
      entries: [{ stockItemId: "t", quantity: 8000, unitCost: c }],
      end: [{ stockItemId: "t", quantity: 8000, unitCost: c }],
      sales: [{ menuItemId: "p", name: "Pâtes", quantity: 50, revenueHT: 400, foodCost: 200 * c }],
      losses: [],
    });
    expect(report.variance).toBe(0);
    expect(report.variancePoints).toBe(0);
  });

  it("puts the unexplained consumption in euros and points of revenue", () => {
    const report = foodCostReport({
      start: [{ stockItemId: "x", quantity: 100, unitCost: 1 }],
      entries: [{ stockItemId: "x", quantity: 100, unitCost: 1 }],
      end: [{ stockItemId: "x", quantity: 40, unitCost: 1 }],
      sales: [{ menuItemId: "p", name: "Plat", quantity: 100, revenueHT: 1000, foodCost: 1.3 }],
      losses: [{ value: 10 }],
    });
    // real 160, theoretical 130
    expect(report.real).toBe(160);
    expect(report.theoretical).toBe(130);
    expect(report.variance).toBe(30);
    expect(report.variancePoints).toBe(3);
    expect(report.theoreticalRatio).toBe(13);
    expect(report.realRatio).toBe(16);
    expect(report.lossesValue).toBe(10);
    expect(report.unexplained).toBe(20);
  });

  it("keeps a production run neutral: ingredients out, preparation in", () => {
    // 2 000 g of tomatoes (0,0005 €/g) become 1 000 ml of sauce (0,001 €/ml),
    // all of it sold in 10 dishes of 100 ml.
    const report = foodCostReport({
      start: [
        { stockItemId: "tomate", quantity: 2000, unitCost: 0.0005 },
        { stockItemId: "sauce", quantity: 0, unitCost: 0.001 },
      ],
      entries: [],
      end: [
        { stockItemId: "tomate", quantity: 0, unitCost: 0.0005 },
        { stockItemId: "sauce", quantity: 0, unitCost: 0.001 },
      ],
      sales: [{ menuItemId: "d", name: "Plat sauce", quantity: 10, revenueHT: 100, foodCost: 0.1 }],
      losses: [],
    });
    expect(report.variance).toBe(0);
  });
});

describe("topDishesByMargin", () => {
  it("ranks the dishes that earn the most, cost and ratio alongside", () => {
    const top = topDishesByMargin(
      [
        { menuItemId: "a", name: "A", quantity: 10, revenueHT: 100, foodCost: 3 },
        { menuItemId: "b", name: "B", quantity: 5, revenueHT: 150, foodCost: 5 },
        { menuItemId: "a", name: "A", quantity: 10, revenueHT: 100, foodCost: 3 },
        { menuItemId: "c", name: "C", quantity: 1, revenueHT: 10, foodCost: null },
      ],
      5,
    );
    expect(top.map((d) => d.name)).toEqual(["A", "B"]);
    expect(top[0]).toMatchObject({ quantity: 20, revenueHT: 200, cost: 60, margin: 140, ratio: 30 });
  });
});

describe("variance wording", () => {
  it("states the unknown figure plainly, never as an accusation", () => {
    expect(varianceHeadline(214, 3.1)).toBe(
      "Tu as consommé 214,00 € de matière de plus que ce que tes ventes expliquent. Soit 3,1 points de marge.",
    );
  });

  it("says so when consumption is below what sales explain", () => {
    expect(varianceHeadline(-12.5, -0.4)).toContain("de moins");
  });

  it("proposes the four checks, always in the same order", () => {
    const causes = varianceCauses({
      bestSeller: "Riz au gras",
      estimatedCards: 3,
      lossesValue: 12,
      costliestFamily: "Viandes",
    });
    expect(causes.map((c) => c.key)).toEqual(["CARDS", "PORTIONS", "LOSSES", "COUNT"]);
    expect(causes[0].test).toContain("Riz au gras");
    expect(causes[3].test).toContain("Viandes");
    expect(causes.map((c) => c.title).join(" ")).not.toMatch(/vol|faute|coupable/i);
  });
});
