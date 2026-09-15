import { describe, expect, it } from "vitest";

import {
  CATALOGUE,
  convertQuantity,
  findCatalogueRecipe,
  matchIngredient,
  normaliseName,
  proposeRecipe,
} from "./recipe-catalogue";

describe("normaliseName", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normaliseName("  Bœuf Bourguignon (maison) ")).toBe("boeuf bourguignon maison");
    expect(normaliseName("Igname pilée")).toBe("igname pilee");
  });
});

describe("findCatalogueRecipe", () => {
  it("recognises a dish written the restaurant's own way", () => {
    expect(findCatalogueRecipe("Riz au gras")?.key).toBe("riz-au-gras");
    expect(findCatalogueRecipe("Plantains frits (aloco)")?.key).toBe("aloco");
    expect(findCatalogueRecipe("Igname pilee sauce arachide")?.key).toBe("igname-pilee-arachide");
    expect(findCatalogueRecipe("Steak frites maison")?.key).toBe("steak-frites");
  });

  it("proposes nothing rather than a wrong card", () => {
    expect(findCatalogueRecipe("Assiette du chef")).toBeNull();
  });

  it("gives every card at least one line and a positive portion count", () => {
    for (const recipe of CATALOGUE) {
      expect(recipe.lines.length).toBeGreaterThan(0);
      expect(recipe.portions).toBeGreaterThan(0);
    }
  });
});

describe("matchIngredient", () => {
  const stock = [
    { id: "s1", name: "Tomatoes", unit: "KG" as const },
    { id: "s2", name: "Poulet", unit: "KG" as const },
    { id: "s3", name: "Huile", unit: "LITRE" as const },
  ];

  it("finds the stock item under its French or English name", () => {
    expect(matchIngredient("tomate", stock)?.id).toBe("s1");
    expect(matchIngredient("poulet", stock)?.id).toBe("s2");
    expect(matchIngredient("huile", stock)?.id).toBe("s3");
  });

  it("prefers the French stock name over an English duplicate", () => {
    const both = [
      { id: "en", name: "Fish", unit: "KG" as const },
      { id: "fr", name: "Poisson frais", unit: "KG" as const },
    ];
    expect(matchIngredient("poisson", both)?.id).toBe("fr");
  });

  it("returns null when nothing in stock resembles the ingredient", () => {
    expect(matchIngredient("gingembre", stock)).toBeNull();
  });
});

describe("convertQuantity", () => {
  it("converts grams and millilitres into the stock item's unit", () => {
    expect(convertQuantity(250, "GRAM", "KG")).toBe(0.25);
    expect(convertQuantity(30, "ML", "LITRE")).toBe(0.03);
    expect(convertQuantity(2, "PIECE", "PIECE")).toBe(2);
    expect(convertQuantity(24, "PIECE", "DOZEN")).toBe(2);
  });

  it("refuses to turn grams into pieces", () => {
    expect(convertQuantity(100, "GRAM", "PIECE")).toBeNull();
  });
});

describe("proposeRecipe", () => {
  it("maps the catalogue card onto the restaurant's stock, flagging what is missing", () => {
    const proposal = proposeRecipe("Riz au gras", [
      { id: "riz", name: "Riz", unit: "KG" },
      { id: "tom", name: "Tomates", unit: "KG" },
    ]);
    expect(proposal?.recipe.key).toBe("riz-au-gras");
    const rice = proposal?.lines.find((l) => l.stockItemId === "riz");
    expect(rice?.quantity).toBeGreaterThan(0);
    expect(proposal?.lines.some((l) => l.stockItemId === null)).toBe(true);
  });
});
