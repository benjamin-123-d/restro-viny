import { describe, expect, it } from "vitest";

import {
  emptyLine,
  expenseLinesFrom,
  linesFromReading,
  stockLinesFrom,
  summarise,
  visibleLines,
  type ReceiptLineDraft,
} from "./receipt-lines-state";
import { breakdownMatches } from "./purchase-categories";
import type { ReceiptLine } from "./receipt-parser";

const read: ReceiptLine[] = [
  { label: "5KG FARINE POUR PIZZA NO3", amount: 31.5, category: "DENREES", vatRate: 5.5, code: "674015", quantity: 6, unitPrice: 5.25, family: "Epicerie salee" },
  { label: "BTE 33CL SLIM COCA COLA", amount: 55.68, category: "BOISSONS", vatRate: 5.5, code: "345912", quantity: 96, unitPrice: 0.65, family: "Brasserie" },
  { label: "50 CABAS PAPIER BRUN 26X14X33", amount: 16.76, category: "EMBALLAGES", vatRate: 20, code: "536492", quantity: 2, unitPrice: 8.38, family: "Bazar" },
];

const drafts = (): ReceiptLineDraft[] => linesFromReading(read);

describe("linesFromReading", () => {
  it("keeps every column the invoice printed", () => {
    const [first] = drafts();
    expect(first).toMatchObject({
      label: "5KG FARINE POUR PIZZA NO3",
      amount: "31,5",
      quantity: "6",
      category: "DENREES",
      family: "Epicerie salee",
      code: "674015",
      vatRate: 5.5,
      stockItemId: null,
      ignored: false,
    });
  });
});

describe("visibleLines", () => {
  const lines = drafts();

  it("filters by category", () => {
    expect(visibleLines(lines, "BOISSONS", "").map((l) => l.code)).toEqual(["345912"]);
  });

  it("searches the label and the article code", () => {
    expect(visibleLines(lines, "TOUT", "coca").map((l) => l.code)).toEqual(["345912"]);
    expect(visibleLines(lines, "TOUT", "536492").map((l) => l.code)).toEqual(["536492"]);
  });

  it("« ce qui reste à traiter » hides linked and ignored lines", () => {
    const worked = lines.map((line, i) =>
      i === 0 ? { ...line, stockItemId: "farine" } : i === 1 ? { ...line, ignored: true } : line,
    );
    expect(visibleLines(worked, "A_TRAITER", "").map((l) => l.code)).toEqual(["536492"]);
  });
});

describe("summarise", () => {
  it("adds up what is kept, by category, and says what feeds the food cost", () => {
    const lines = [...drafts(), { ...emptyLine(), label: "Consigne", amount: "5,00", ignored: true }];
    const summary = summarise(lines);
    expect(summary.kept).toBe(3);
    expect(summary.ignored).toBe(1);
    expect(summary.total).toBe(103.94);
    expect(summary.foodAmount).toBe(87.18);
    expect(summary.byCategory).toEqual([
      { category: "BOISSONS", amount: 55.68 },
      { category: "DENREES", amount: 31.5 },
      { category: "EMBALLAGES", amount: 16.76 },
    ]);
  });

  it("ignores an empty line the owner has not filled yet", () => {
    expect(summarise([emptyLine()]).kept).toBe(0);
  });
});

describe("expenseLinesFrom", () => {
  it("groups by category and VAT rate, keeping wholesaler amounts as HT", () => {
    const lines = expenseLinesFrom(drafts(), "HT");
    expect(lines).toEqual([
      { category: "DENREES", vatRate: 5.5, amountHT: 31.5, vatAmount: 1.73 },
      { category: "BOISSONS", vatRate: 5.5, amountHT: 55.68, vatAmount: 3.06 },
      { category: "EMBALLAGES", vatRate: 20, amountHT: 16.76, vatAmount: 3.35 },
    ]);
  });

  it("splits a till ticket's TTC amounts so the total still matches", () => {
    const lines = expenseLinesFrom(
      [
        { ...emptyLine("DENREES", 5.5), label: "Tomates", amount: "42,20" },
        { ...emptyLine("ENTRETIEN", 20), label: "Javel", amount: "12,00" },
      ],
      "TTC",
    );
    expect(breakdownMatches(lines, 54.2)).toBe(true);
  });
});

describe("stockLinesFrom", () => {
  it("keeps only the linked lines, always before VAT", () => {
    const lines = drafts().map((line, i) => (i === 0 ? { ...line, stockItemId: "farine" } : line));
    expect(stockLinesFrom(lines, "HT")).toEqual([{ stockItemId: "farine", quantity: 6, amount: 31.5 }]);
    expect(stockLinesFrom(lines, "TTC")).toEqual([{ stockItemId: "farine", quantity: 6, amount: 29.86 }]);
  });

  it("counts one unit when the ticket gives no quantity", () => {
    const line = { ...emptyLine(), label: "Sac de riz", amount: "18,00", stockItemId: "riz" };
    expect(stockLinesFrom([line], "HT")).toEqual([{ stockItemId: "riz", quantity: 1, amount: 18 }]);
  });
});
