import { describe, expect, it } from "vitest";

import { cleanOcrLine, parseAmountToken, parseReceiptText } from "./receipt-parser";

const METRO = `
METRO NANTERRE
Metro France SAS - SIRET 399 315 613 00178
12 avenue de la Commune de Paris 92000 NANTERRE
Facture n° 0178-2026-004512
Date : 14/09/2026 08:42
CLIENT 1234567 RESTAURANT VINY
TOMATE GRAPPE CAT1 5KG        12,90 A
CREME FRAICHE EPAISSE 35% 1L   6,45 A
OIGNON JAUNE 10KG              9,80 A
JAVEL LA CROIX 5L              8,40 B
LIQUIDE VAISSELLE 5L          11,50 B
POELE INOX 28CM               24,90 B
SOUS-TOTAL                    73,95
TVA   TAUX     HT     TVA
A     5,50%   27,63   1,52
B    20,00%   37,33   7,47
TOTAL HT                      64,96
TOTAL TVA                      8,99
TOTAL TTC                     73,95
CB                            73,95
MERCI DE VOTRE VISITE
`;

const SUPERMARKET = `
CARREFOUR MARKET
PARIS 11 RUE DE LA ROQUETTE
TICKET 0452 CAISSE 03
2 X 1,49
COCA COLA 33CL          2,98
BARQUETTES ALU X50      5,90
BEURRE DOUX 250G        2,65
REMISE FIDELITE        -0,50
NB ARTICLES 5
TOTAL A PAYER          11,03 EUR
ESPECES                20,00
RENDU                   8,97
15.09.26 12:05
`;

const MARKET = `
Primeur Chez Jojo
marché d'Aligre
le 13/09/2026
Courgettes 3kg 6.00
Herbes fraîches 4.50
Total 10.50
Payé en espèces
`;

describe("parseAmountToken", () => {
  it("reads amounts the way French tickets print them", () => {
    expect(parseAmountToken("12,90")).toBe(12.9);
    expect(parseAmountToken("1 234,56")).toBe(1234.56);
    expect(parseAmountToken("1.234,56")).toBe(1234.56);
    expect(parseAmountToken("7.47")).toBe(7.47);
    expect(parseAmountToken("-0,50")).toBe(-0.5);
    expect(parseAmountToken("1O,5O")).toBe(10.5);
  });
});

describe("parseReceiptText — wholesaler invoice", () => {
  const reading = parseReceiptText(METRO);

  it("finds the shop, its SIRET, the date and the number", () => {
    expect(reading.shopName).toBe("Metro");
    expect(reading.siret).toBe("39931561300178");
    expect(reading.date).toBe("2026-09-14");
    expect(reading.ticketNumber).toBe("0178-2026-004512");
  });

  it("takes the TTC total, not the subtotal or the HT total", () => {
    expect(reading.totalTTC).toBe(73.95);
    expect(reading.totalHT).toBe(64.96);
  });

  it("reads the VAT table", () => {
    expect(reading.vat).toEqual([
      { code: "A", rate: 5.5, base: 27.63, amount: 1.52 },
      { code: "B", rate: 20, base: 37.33, amount: 7.47 },
    ]);
  });

  it("lists the item lines with a suggested category and their VAT rate", () => {
    expect(reading.lines.map((l) => [l.label, l.amount, l.category, l.vatRate])).toEqual([
      ["TOMATE GRAPPE CAT1 5KG", 12.9, "DENREES", 5.5],
      ["CREME FRAICHE EPAISSE 35% 1L", 6.45, "DENREES", 5.5],
      ["OIGNON JAUNE 10KG", 9.8, "DENREES", 5.5],
      ["JAVEL LA CROIX 5L", 8.4, "ENTRETIEN", 20],
      ["LIQUIDE VAISSELLE 5L", 11.5, "ENTRETIEN", 20],
      ["POELE INOX 28CM", 24.9, "MATERIEL", 20],
    ]);
  });

  it("recognises the payment and trusts a reading whose lines add up", () => {
    expect(reading.paymentMode).toBe("CARD");
    expect(reading.confidence).toBe("high");
  });
});

describe("parseReceiptText — supermarket ticket", () => {
  const reading = parseReceiptText(SUPERMARKET);

  it("reads the shop, the short date and the total to pay", () => {
    expect(reading.shopName).toBe("Carrefour");
    expect(reading.date).toBe("2026-09-15");
    expect(reading.totalTTC).toBe(11.03);
    expect(reading.ticketNumber).toBe("0452");
    expect(reading.paymentMode).toBe("CASH");
  });

  it("keeps discounts, skips payment and count lines", () => {
    expect(reading.lines.map((l) => [l.label, l.amount, l.category])).toEqual([
      ["COCA COLA 33CL", 2.98, "BOISSONS"],
      ["BARQUETTES ALU X50", 5.9, "EMBALLAGES"],
      ["BEURRE DOUX 250G", 2.65, "DENREES"],
      ["REMISE FIDELITE", -0.5, "DENREES"],
    ]);
    expect(parseReceiptText("JAVEL 5L 8,40\nREMISE -1,00\nTOTAL 7,40").lines.map((l) => l.category)).toEqual([
      "ENTRETIEN",
      "ENTRETIEN",
    ]);
    expect(reading.confidence).toBe("high");
  });
});

describe("parseReceiptText — handwritten market receipt", () => {
  it("falls back to the first line as the shop and reads dotted amounts", () => {
    const reading = parseReceiptText(MARKET);
    expect(reading.shopName).toBe("Primeur Chez Jojo");
    expect(reading.date).toBe("2026-09-13");
    expect(reading.totalTTC).toBe(10.5);
    expect(reading.lines).toHaveLength(2);
    expect(reading.paymentMode).toBe("CASH");
  });
});

describe("parseReceiptText — unreadable photo", () => {
  it("returns nothing it is unsure of, with a low confidence", () => {
    const reading = parseReceiptText("~~ ##\n.. ,,\n");
    expect(reading.totalTTC).toBeNull();
    expect(reading.lines).toEqual([]);
    expect(reading.confidence).toBe("low");
  });
});

describe("cleanOcrLine", () => {
  it("repairs the usual OCR slips on tickets", () => {
    expect(cleanOcrLine("TOMATE GRAPPE 5KG        12,90 À")).toBe("TOMATE GRAPPE 5KG 12,90 A");
    expect(cleanOcrLine("A 5,50$%   27,63   1,52")).toBe("A 5,50% 27,63 1,52");
    expect(cleanOcrLine("B 20,00%   37, 33   7,47")).toBe("B 20,00% 37,33 7,47");
  });

  it("reads a noisy photo well enough to trust its total", () => {
    const reading = parseReceiptText(
      "METRO NANTERRE\nTOMATE GRAPPE 5KG        12,90 À\nJAVEL LA CROIX 51,         8,40 B\nA 5,50$%   27,63   1,32\nB 20,00%   37, 33   7,47\nTOTAL TTC                73,95\nCB                      73,95",
    );
    expect(reading.totalTTC).toBe(73.95);
    expect(reading.lines.map((l) => l.label)).toEqual(["TOMATE GRAPPE 5KG", "JAVEL LA CROIX"]);
    expect(reading.vat.map((v) => v.rate)).toEqual([5.5, 20]);
  });
});
