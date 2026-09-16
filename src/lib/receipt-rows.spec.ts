import { describe, expect, it } from "vitest";

import { cellsFromPdfItems, cellsFromWords, rowsFromCells, rowsToText } from "./receipt-rows";

describe("rowsFromCells", () => {
  it("puts a label back with the amount printed on its right", () => {
    const rows = rowsFromCells([
      { x: 420, y: 100, text: "31,50" },
      { x: 30, y: 101, text: "674015" },
      { x: 90, y: 100.5, text: "5KG FARINE POUR PIZZA NO3" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].cells).toEqual(["674015", "5KG FARINE POUR PIZZA NO3", "31,50"]);
  });

  it("keeps two printed lines apart", () => {
    const rows = rowsFromCells([
      { x: 30, y: 100, text: "Ligne du haut" },
      { x: 30, y: 120, text: "Ligne du bas" },
    ]);
    expect(rows.map((r) => r.text)).toEqual(["Ligne du haut", "Ligne du bas"]);
  });

  it("never joins two pages, even at the same height", () => {
    const rows = rowsFromCells([
      { x: 30, y: 100, text: "Page une", page: 1 },
      { x: 30, y: 100, text: "Page deux", page: 2 },
    ]);
    expect(rows.map((r) => r.text)).toEqual(["Page une", "Page deux"]);
  });

  it("ignores empty pieces of text", () => {
    expect(rowsFromCells([{ x: 1, y: 1, text: "   " }])).toEqual([]);
  });

  it("reads rows top to bottom and cells left to right", () => {
    const rows = rowsFromCells([
      { x: 200, y: 50, text: "b" },
      { x: 10, y: 50, text: "a" },
      { x: 10, y: 10, text: "titre" },
    ]);
    expect(rowsToText(rows)).toBe("titre\na  b");
  });
});

describe("cellsFromWords", () => {
  it("takes the middle of each word, so a tall word stays on its line", () => {
    const cells = cellsFromWords([
      { text: "TOTAL", bbox: { x0: 10, y0: 100, y1: 130 } },
      { text: "12,90", bbox: { x0: 300, y0: 105, y1: 125 } },
    ]);
    expect(rowsFromCells(cells)[0].cells).toEqual(["TOTAL", "12,90"]);
  });
});

describe("cellsFromPdfItems", () => {
  it("flips the page upside down, because a PDF measures from the bottom", () => {
    const cells = cellsFromPdfItems(
      [
        { str: "en bas", transform: [1, 0, 0, 1, 10, 50] },
        { str: "en haut", transform: [1, 0, 0, 1, 10, 800] },
      ],
      1,
      842,
    );
    expect(rowsFromCells(cells).map((r) => r.text)).toEqual(["en haut", "en bas"]);
  });
});
