import { describe, expect, it } from "vitest";

import { foldText, hasExactMatch, matchesSearch, rankMatches } from "./search-text";

describe("foldText", () => {
  it("ignores case, accents, ligatures and punctuation", () => {
    expect(foldText("Crème fraîche 35 %")).toBe("creme fraiche 35");
    expect(foldText("Œufs")).toBe("oeufs");
  });
});

describe("matchesSearch", () => {
  it("finds a label whatever the accents and word order", () => {
    expect(matchesSearch("Crème fraîche", "fraiche creme")).toBe(true);
    expect(matchesSearch("Crème fraîche", "beurre")).toBe(false);
  });

  it("matches everything on an empty query", () => {
    expect(matchesSearch("Tomates", "  ")).toBe(true);
  });
});

describe("rankMatches", () => {
  it("puts labels that start with the query first", () => {
    const options = [{ label: "Sauce tomate" }, { label: "Tomates" }, { label: "Oignons" }];
    expect(rankMatches(options, "tom").map((o) => o.label)).toEqual(["Tomates", "Sauce tomate"]);
  });
});

describe("hasExactMatch", () => {
  it("recognises an existing name so it is not created twice", () => {
    expect(hasExactMatch([{ label: "Crème fraîche" }], "creme  FRAICHE")).toBe(true);
    expect(hasExactMatch([{ label: "Crème fraîche" }], "crème")).toBe(false);
    expect(hasExactMatch([{ label: "Crème fraîche" }], "")).toBe(false);
  });
});
