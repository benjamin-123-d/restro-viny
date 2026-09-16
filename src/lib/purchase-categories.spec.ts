import { describe, expect, it } from "vitest";

import {
  breakdownGap,
  breakdownMatches,
  breakdownTotals,
  isFoodCategory,
  suggestCategory,
} from "./purchase-categories";

describe("suggestCategory", () => {
  it("recognises cleaning products whatever the accents or case", () => {
    expect(suggestCategory("EAU DE JAVEL 2L")).toBe("ENTRETIEN");
    expect(suggestCategory("Liquide vaisselle citron")).toBe("ENTRETIEN");
    expect(suggestCategory("Éponges grattantes x10")).toBe("ENTRETIEN");
    expect(suggestCategory("Pastilles lave-vaisselle")).toBe("ENTRETIEN");
  });

  it("recognises equipment and packaging", () => {
    expect(suggestCategory("Poêle inox 28 cm")).toBe("MATERIEL");
    expect(suggestCategory("Bac gastro GN 1/1")).toBe("MATERIEL");
    expect(suggestCategory("Barquettes alu x50")).toBe("EMBALLAGES");
    expect(suggestCategory("Film étirable 300m")).toBe("EMBALLAGES");
  });

  it("recognises drinks", () => {
    expect(suggestCategory("COCA COLA 33CL X24")).toBe("BOISSONS");
    expect(suggestCategory("Bière blonde 25cl")).toBe("BOISSONS");
  });

  it("falls back to food, which is most of what a restaurant buys", () => {
    expect(suggestCategory("Tomates grappe 5kg")).toBe("DENREES");
    expect(suggestCategory("Crème fraîche 35%")).toBe("DENREES");
  });

  it("does not mistake a word that merely contains a keyword", () => {
    expect(suggestCategory("Oignons rouges")).toBe("DENREES");
    expect(suggestCategory("Vinaigre de vin rouge")).toBe("DENREES");
    expect(suggestCategory("Sauce vin blanc")).toBe("DENREES");
    expect(suggestCategory("Thon albacore")).toBe("DENREES");
    expect(suggestCategory("Vinaigrette")).toBe("DENREES");
  });
});

describe("breakdownTotals", () => {
  it("computes VAT from the rate and adds up per category", () => {
    const result = breakdownTotals([
      { category: "DENREES", amountHT: 40, vatRate: 5.5 },
      { category: "ENTRETIEN", amountHT: 10, vatRate: 20 },
      { category: "DENREES", amountHT: 20, vatRate: 5.5 },
    ]);
    expect(result.totalHT).toBe(70);
    expect(result.totalVAT).toBe(5.3);
    expect(result.totalTTC).toBe(75.3);
    expect(result.byCategory).toEqual({ DENREES: 60, ENTRETIEN: 10 });
    expect(result.foodHT).toBe(60);
  });

  it("keeps the VAT printed on the ticket when given", () => {
    const result = breakdownTotals([{ category: "MATERIEL", amountHT: 24.99, vatRate: 20, vatAmount: 5 }]);
    expect(result.totalTTC).toBe(29.99);
  });
});

describe("breakdownGap", () => {
  const lines = [
    { category: "DENREES" as const, amountHT: 40, vatRate: 5.5 },
    { category: "ENTRETIEN" as const, amountHT: 10, vatRate: 20 },
  ];

  it("shows what is still missing from the breakdown", () => {
    expect(breakdownGap(lines, 66.2)).toBe(12);
    expect(breakdownMatches(lines, 66.2)).toBe(false);
  });

  it("accepts a few cents of ticket rounding", () => {
    expect(breakdownMatches(lines, 54.23)).toBe(true);
    expect(breakdownMatches(lines, 54.3)).toBe(false);
  });
});

describe("isFoodCategory", () => {
  it("counts only food and drinks as food cost", () => {
    expect(isFoodCategory("DENREES")).toBe(true);
    expect(isFoodCategory("BOISSONS")).toBe(true);
    expect(isFoodCategory("ENTRETIEN")).toBe(false);
    expect(isFoodCategory("MATERIEL")).toBe(false);
  });
});
