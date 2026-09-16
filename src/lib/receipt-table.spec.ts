import { describe, expect, it } from "vitest";

import { readReceiptTable, readTableLine, tableTotal } from "./receipt-table";

/**
 * The rows of a real wholesaler invoice (Promocash Cholet, 369,91 € TTC), once
 * put back in printed order. Client name, address and bank details removed.
 */
const INVOICE = `FACTURE  N° Facture :  294501
Date :  15/09/2026 à 10h21
Total TTC :  369,91 €
Type de Retrait :  MAGASIN  Date Livraison :  Poids livré :
Remise  Remise  Montant  Emballage
Code  Libellé Produit  Qté  TVA  PU HT
Total HT  Motif  HT
674015  5KG FARINE POUR PIZZA NO3  6  5,5%  5,25  31,50
Total EPICERIE SALEE  31,50
012448  33CL FANTA ORANGE BTE  48  5,5%  0,62  29,76
319561  33CL CAN SLK 7UP REGULAR  24  5,5%  0,52  12,48
321011  PET 1.5L EAU SOURCE CRISTALINE  6  5,5%  0,23  1,38
345912  BTE 33CL SLIM COCA COLA  96  5,5%  0,65  6,720  Promo  55,68
Dont application remise immédiate totale de
5,76
346095  BTE 33CL SLIM FANTA CITRON  24  5,5%  0,59  14,16
346108  BTE 33CL FUZETEA PECHE SLEE  24  5,5%  0,54  0,240  Promo  12,72
383941  33CL CAN SLIM TROPICAL OASIS  48  5,5%  0,60  28,80
424546  PET 1.25LX6 COCA COLA  2  5,5%  11,56  23,12
575579  BTE 33CL OASIS THE PECHE  24  5,5%  0,52  12,48
778766  10X20CL CAPRI SUN MULTIVI  4  5,5%  3,53  14,12
804814  12X50CL CRISTALINE  3  5,5%  1,93  5,79
945087  BTE SLIM 33CL OASIS POM CASSIS  24  5,5%  0,59  14,16
Total BRASSERIE  224,65
639519  1KG EGRENE 70%VDE 15%MG VBF  2  5,5%  13,76  27,52
Total SURGELES  27,52
Promocash Cholet au capital de 148.600 EUROS - 10 Rue de Vouvray 49300 CHOLET
RCS : ANGERS - N° Siret : 50419724500013 - N° TVA : FR34504197245  1 /  2
Code  Libellé Produit  Qté  TVA  PU HT
283619  180G BUCHE LAIT VACHE/CHEVRE  7  5,5%  1,66  11,62
427559  5L CREME FRAICHE LEGERE EPAISS  1  5,5%  21,50  21,50
Total CREMERIE  33,12
536492  50 CABAS PAPIER BRUN 26X14X33  2  20,0%  8,38  16,76
536522  50 CABAS PAPIER BRUN 22X10X28  1  20,0%  7,49  7,49
691831  COUPE PATE SOUPLE  1  20,0%  5,50  5,50
REMISE IMMEDIATE TVA 5,50 % : 5,76
Total BAZAR  29,75
Ventilation par TVA
TVA %  Mt HT  Mt TVA  Mt TTC
5,5%  316,79  17,42  334,21
20,0%  29,75  5,95  35,70  TOTAL HT  346,54 €
Totaux  346,54  23,37  369,91
TOTAL TVA  23,37 €
TOTAL TTC  369,91 €
NET A PAYER:  369,91 €`
  .split("\n");

describe("readReceiptTable — facture fournisseur en colonnes", () => {
  const table = readReceiptTable(INVOICE);

  it("trouve les 19 lignes achetées, et rien d'autre", () => {
    expect(table.lines).toHaveLength(19);
  });

  it("lit chaque colonne d'une ligne simple", () => {
    expect(table.lines[0]).toEqual({
      code: "674015",
      label: "5KG FARINE POUR PIZZA NO3",
      quantity: 6,
      vatRate: 5.5,
      vatCode: null,
      unitPrice: 5.25,
      amount: 31.5,
      family: "Epicerie salee",
    });
  });

  it("prend le montant final même quand une remise s'intercale", () => {
    const coca = table.lines.find((line) => line.code === "345912");
    expect(coca).toMatchObject({ label: "BTE 33CL SLIM COCA COLA", quantity: 96, unitPrice: 0.65, amount: 55.68 });
  });

  it("reconnaît les familles du ticket", () => {
    expect(table.families).toEqual(["Epicerie salee", "Brasserie", "Surgeles", "Cremerie", "Bazar"]);
    expect(table.lines.filter((l) => l.family === "Brasserie")).toHaveLength(12);
    expect(table.lines.filter((l) => l.family === "Bazar")).toHaveLength(3);
  });

  it("ignore les totaux de famille, les remises et le pavé légal", () => {
    const labels = table.lines.map((line) => line.label);
    expect(labels.some((l) => /^total/i.test(l))).toBe(false);
    expect(labels.some((l) => /remise/i.test(l))).toBe(false);
    expect(labels.some((l) => /promocash cholet au capital/i.test(l))).toBe(false);
    expect(labels.some((l) => /ventilation|net a payer/i.test(l))).toBe(false);
  });

  it("sait que les montants de cette facture sont hors taxes", () => {
    expect(table.amountsAre).toBe("HT");
  });

  it("retombe sur le total hors taxes de la facture", () => {
    expect(tableTotal(table.lines)).toBe(346.54);
  });

  it("garde les deux taux de TVA", () => {
    expect(new Set(table.lines.map((l) => l.vatRate))).toEqual(new Set([5.5, 20]));
  });
});

describe("readTableLine — ticket de caisse", () => {
  it("lit une ligne de supermarché, sans code ni TVA", () => {
    expect(readTableLine("COCA COLA 33CL          2,98", "TTC")).toMatchObject({
      code: null,
      label: "COCA COLA 33CL",
      amount: 2.98,
      vatRate: null,
    });
  });

  it("refuse une ligne de paiement ou de total", () => {
    expect(readTableLine("TOTAL A PAYER          11,03 EUR", "TTC")).toBeNull();
    expect(readTableLine("ESPECES                20,00", "TTC")).toBeNull();
    expect(readTableLine("NB ARTICLES 5", "TTC")).toBeNull();
  });

  it("refuse une ligne sans montant", () => {
    expect(readTableLine("MERCI DE VOTRE VISITE", "TTC")).toBeNull();
  });
});
