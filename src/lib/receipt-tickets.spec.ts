import { describe, expect, it } from "vitest";

import { readReceiptTable, readTableLine, tableTotal, vatKeysIn } from "./receipt-table";

/**
 * Four real purchases the restaurant brought in, each printed a different way.
 * They are the training set: every rule in receipt-table.ts that is not obvious
 * exists because one of these tickets needed it.
 *
 * Shop names and amounts are kept as printed; client codes and bank details
 * are not reproduced.
 */

/**
 * 1. Carrefour, till receipt on crumpled paper (40,13 € TTC).
 *    The figure in front of the wording is the VAT key, the rate itself is
 *    explained at the foot, and the families are announced by their totals.
 */
const CARREFOUR = `Bienvenue chez
Carrefour
ANGERS GD MAINE
TEL 02 41 22 24 79
CARREFOUR ANGERS GRAND MAINE
DU LUNDI AU SAMEDI DE 8H30 A 21H00
DESIGNATION  P.U x QTE  MONTANT€
4 ASSORTIMENT PATISS  6,99x2  13,98
4 FLAN PATE TARTINX2  2,61x2  5,22
4 TARTELETTE AUX FRA  4,19x2  8,38
Total Alimentaire  27,58
6 SAC DE CAISSE  0,65
6 20 LAVETTES  11,90
Total Non Alimentaire  12,55
8 ARTICLES  TOTAL A PAYER  40,13
€  Cartes Bancaires  40,13
TVA 4: 5,50% €  26,14  1,44
TVA 6:20,00% €  10,46  2,09
==== TOTAL TVA  €  3,53
05.08.2026 18:42 0502154 0159 404`.split("\n");

describe("ticket Carrefour", () => {
  const table = readReceiptTable(CARREFOUR);

  it("lit les cinq articles et rien d'autre", () => {
    expect(table.lines.map((line) => line.label)).toEqual([
      "ASSORTIMENT PATISS",
      "FLAN PATE TARTINX2",
      "TARTELETTE AUX FRA",
      "SAC DE CAISSE",
      "20 LAVETTES",
    ]);
  });

  it("tombe exactement sur le total payé", () => {
    expect(tableTotal(table.lines)).toBe(40.13);
  });

  it("comprend « 6,99x2 » comme deux articles à 6,99 €", () => {
    expect(table.lines[0]).toMatchObject({ quantity: 2, unitPrice: 6.99, amount: 13.98 });
  });

  it("donne à chaque ligne le taux que le ticket explique en bas", () => {
    expect(vatKeysIn(CARREFOUR)).toEqual(new Map([["4", 5.5], ["6", 20]]));
    expect(table.lines.map((line) => line.vatRate)).toEqual([5.5, 5.5, 5.5, 20, 20]);
  });

  it("garde les familles du ticket", () => {
    expect(table.families).toEqual(["Alimentaire", "Non alimentaire"]);
    expect(table.lines[4].family).toBe("Non alimentaire");
  });
});

/**
 * 2. E.Leclerc, till receipt (53,76 € TTC).
 *    Families announced *above* their lines, decimal points instead of commas,
 *    a VAT key after the amount, and one article whose wording is on one row
 *    and its price on the next.
 */
const LECLERC = `E.Leclerc
ANGERS
e-leclerc.com/angers
TEL:02.41.73.28.88
Caisse 003-0705 01 septembre 2026 19:35
Ticket 01/09/26 0 03T1 06B00
TTC  TVA
>> D.P.H.
SPRAY FRUITS DES BOIS,AUR.250M  2.41  5
>> PARFUMERIE/HYGIENE
VU NETTOYANT OPTIQUE  1.89  5
LINGETTES OPTIQUES X52 ECO+  1.28  5
HUILE BARBE BR CLUB,MENEX,30ML  9.30  5
>> PATISSERIE/VIENNOISERIE
PATISSERIE  3.80  2
4 PATISSERIES INDIVIDUELLE  4.90  2
TARTELETTE FRAISE X2  3.80  2
ASSORTIMENT TARTELETTES X4
2 X 5.90€  11.80  2
>> BAZAR -
SAC KRAFT AMBIANT DRIVE 80G,1P  0.20  5
BIC VELLEDA FEUTRE EFFACABLE X1  0.99  5
AGRAF. H STRIP UNIVERSAL 24/6 2  6.62  5
ARBRE MAGIQUE BLACK CLASSIC  1.28  5
HUILIER PULVERISATEUR 250ML EN  5.49  5
Total 14 articles  53.76
CB  53.76
Code  HT  TVA  TTC
2  5%50  23.03  1.27  24.30
5  20%00  24.55  4.91  29.46
Merci de votre compréhension.`.split("\n");

describe("ticket E.Leclerc", () => {
  const table = readReceiptTable(LECLERC);

  it("lit les treize lignes, total compris", () => {
    expect(table.lines).toHaveLength(13);
    expect(tableTotal(table.lines)).toBe(53.76);
  });

  it("recolle un article dont le prix est sur la ligne suivante", () => {
    expect(table.lines[7]).toMatchObject({
      label: "ASSORTIMENT TARTELETTES X4",
      quantity: 2,
      unitPrice: 5.9,
      amount: 11.8,
    });
  });

  it("traduit la clé de TVA grâce au récapitulatif du bas", () => {
    expect(vatKeysIn(LECLERC)).toEqual(new Map([["2", 5.5], ["5", 20]]));
    const at = (rate: number) =>
      Math.round(table.lines.filter((line) => line.vatRate === rate).reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
    expect(at(5.5)).toBe(24.3);
    expect(at(20)).toBe(29.46);
  });

  it("garde les rayons annoncés au-dessus des lignes", () => {
    expect(table.families).toEqual(["D.P.H.", "Parfumerie/hygiene", "Patisserie/viennoiserie", "Bazar"]);
  });
});

/**
 * 3. METRO, wholesaler invoice scanned in four pages (659,01 € TTC).
 *    Ten columns, of which two look like quantities: the alcohol degree and
 *    the packing. Only the arithmetic says which one was bought.
 */
const METRO = `N° FACTURE  0/0 (078) 0053/020165  (053-049658)  078/238
METRO ANGERS  PAGE :  1/4
Date facture :  09-06-2026 13:56
MM EAN  Numéro  Désignation  Régie Vol  VAP  Poids ou  Prix  Qté  Montant TVA Promo Extr.
3099873045864  1765312  WH JACK DANIEL'S 40D 70CL  S  40,0  0,280  0,700  13,880  1  1  13,88  D  P
PRIX AU KG OU AU LITRE: 19,829
Plus : COTIS. SECURITE SOCIALE  1,74  D
3147690051206  1933670  WHISKY LABEL 5 40D 70CL  S  40,0  0,280  0,700  8,260  1  3  24,78  D  P
PRIX AU KG OU AU LITRE: 11,800
7630040408639  3110269  MARTINI BLANC 14,5D 1L  F  1,000  7,370  1  1  7,37  D  P
*** SPIRITUEUX Total: 103,16
3211209161134  2692556  VUE ROUGE 11D 150CL  T  1,500  1,918  6  1  11,51  D
3211209161165  2692630  VUE ROSE 11D 150CL  T  1,500  1,918  6  1  11,51  D
*** CAVE Total: 34,53`.split("\n");

describe("facture METRO", () => {
  const table = readReceiptTable(METRO);

  it("ne met pas le code article dans la désignation", () => {
    expect(table.lines[0].label).toBe("WH JACK DANIEL'S 40D 70CL");
    expect(table.lines[0].code).toBe("1765312");
  });

  it("prend la quantité achetée, pas le degré d'alcool", () => {
    expect(table.lines[0]).toMatchObject({ quantity: 1, unitPrice: 13.88, amount: 13.88 });
    expect(table.lines[2]).toMatchObject({ quantity: 3, unitPrice: 8.26, amount: 24.78 });
    expect(table.lines[4]).toMatchObject({ quantity: 6, unitPrice: 1.918, amount: 11.51 });
  });

  it("garde la cotisation sécurité sociale, qui est bien payée", () => {
    expect(table.lines[1]).toMatchObject({ label: "Plus : COTIS. SECURITE SOCIALE", amount: 1.74 });
  });

  it("reconnaît les familles écrites « SPIRITUEUX Total »", () => {
    expect(table.families).toEqual(["Spiritueux", "Cave"]);
  });
});

/**
 * 4. Super U, till receipt (134,52 € TTC). Its PDF is a JBIG2 scan that cannot
 *    be rendered here, but its rows are printed like this: the amount carries
 *    its currency and the VAT key follows it.
 */
describe("ticket Super U", () => {
  it("lit le montant et laisse la clé de TVA de côté", () => {
    expect(readTableLine("VIN ROUGE BORDEAUX 75CL  179,40 €  13", "TTC")).toMatchObject({
      label: "VIN ROUGE BORDEAUX 75CL",
      amount: 179.4,
      vatCode: "13",
    });
  });
});
