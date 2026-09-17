import { describe, expect, it } from "vitest";

import {
  balanceOf,
  blockingReasons,
  canEdit,
  defaultLabel,
  isBalanced,
  pieceNumber,
  proposeVentilation,
  reverseLines,
  ventilationTotal,
  type PieceHeader,
  type VentilationLine,
} from "./accounting-rules";

/** La facture Auchan de la capture : 66,99 TTC, 55,82 HT, 11,17 de TVA à 20 %. */
const AUCHAN: PieceHeader = {
  kind: "ACHAT",
  thirdPartyName: "Auchan",
  invoiceDate: "2025-12-04",
  entryDate: "2025-12-04",
  amountTTC: 66.99,
  amountHT: 55.82,
  vatRate: 20,
  amountVAT: 11.17,
  isCca: false,
};

const line = (accountCode: string, side: "D" | "C", amount: number): VentilationLine => ({
  accountCode,
  side,
  amount,
  auxiliaryCode: null,
  auxiliaryName: null,
  label: null,
});

describe("la partie double", () => {
  it("accepte une ventilation équilibrée", () => {
    const lines = [line("401000", "C", 66.99), line("445661", "D", 11.17), line("601000", "D", 55.82)];
    expect(balanceOf(lines)).toEqual({ debit: 66.99, credit: 66.99, difference: 0 });
    expect(isBalanced(lines)).toBe(true);
  });

  it("refuse un écart d'un centime", () => {
    const lines = [line("401000", "C", 66.99), line("445661", "D", 11.17), line("601000", "D", 55.81)];
    expect(isBalanced(lines)).toBe(false);
    expect(balanceOf(lines).difference).toBeCloseTo(-0.01, 2);
  });

  it("additionne chaque côté séparément, sans compensation", () => {
    const lines = [line("401000", "C", 100), line("601000", "D", 60), line("606300", "D", 40)];
    expect(ventilationTotal(lines, "D")).toBe(100);
    expect(ventilationTotal(lines, "C")).toBe(100);
  });
});

describe("la ventilation proposée pour un achat", () => {
  const lines = proposeVentilation(AUCHAN, { expenseAccount: "601000" });

  it("écrit les trois lignes de la capture", () => {
    expect(lines).toEqual([
      expect.objectContaining({ accountCode: "401000", side: "C", amount: 66.99 }),
      expect.objectContaining({ accountCode: "445661", side: "D", amount: 11.17 }),
      expect.objectContaining({ accountCode: "601000", side: "D", amount: 55.82 }),
    ]);
  });

  it("est équilibrée par construction", () => {
    expect(isBalanced(lines)).toBe(true);
  });

  it("met le fournisseur au crédit pour le montant payé", () => {
    expect(ventilationTotal(lines, "C")).toBe(AUCHAN.amountTTC);
  });

  it("n'écrit pas de ligne de TVA quand il n'y en a pas", () => {
    const sansTva = proposeVentilation(
      { ...AUCHAN, amountHT: 66.99, amountVAT: 0, vatRate: 0 },
      { expenseAccount: "601000" },
    );
    expect(sansTva).toHaveLength(2);
    expect(sansTva.some((l) => l.accountCode === "445661")).toBe(false);
  });

  it("envoie la charge en 486 quand la case CCA est cochée", () => {
    const cca = proposeVentilation({ ...AUCHAN, isCca: true }, { expenseAccount: "601000" });
    expect(cca[2].accountCode).toBe("486000");
    expect(isBalanced(cca)).toBe(true);
  });

  it("rattrape le centime perdu sur la charge plutôt que de déséquilibrer", () => {
    // 100,00 TTC saisi avec 83,33 HT et 16,66 de TVA : il manque un centime.
    const bancal = proposeVentilation(
      { ...AUCHAN, amountTTC: 100, amountHT: 83.33, amountVAT: 16.66 },
      { expenseAccount: "601000" },
    );
    expect(isBalanced(bancal)).toBe(true);
    expect(bancal[2].amount).toBe(83.34);
  });
});

describe("la ventilation proposée pour une vente", () => {
  const vente: PieceHeader = {
    ...AUCHAN,
    kind: "VENTE",
    thirdPartyName: "Mairie de Cholet",
    amountTTC: 120,
    amountHT: 100,
    vatRate: 20,
    amountVAT: 20,
  };
  const lines = proposeVentilation(vente, { incomeAccount: "706000" });

  it("met le client au débit et le produit au crédit", () => {
    expect(lines).toEqual([
      expect.objectContaining({ accountCode: "411000", side: "D", amount: 120 }),
      expect.objectContaining({ accountCode: "445710", side: "C", amount: 20 }),
      expect.objectContaining({ accountCode: "706000", side: "C", amount: 100 }),
    ]);
    expect(isBalanced(lines)).toBe(true);
  });
});

describe("ce qui empêche de comptabiliser", () => {
  const ok = {
    header: AUCHAN,
    lines: [line("401000", "C", 66.99), line("445661", "D", 11.17), line("601000", "D", 55.82)],
    hasDocument: true,
    closedPeriod: false,
  };

  it("ne dit rien quand tout est en ordre", () => {
    expect(blockingReasons(ok)).toEqual([]);
  });

  it("refuse une ventilation déséquilibrée, en disant de combien", () => {
    const reasons = blockingReasons({ ...ok, lines: [line("401000", "C", 66.99), line("601000", "D", 55.82)] });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("11,17");
  });

  it("refuse une ventilation qui ne fait pas le montant de la facture", () => {
    const reasons = blockingReasons({
      ...ok,
      lines: [line("401000", "C", 50), line("445661", "D", 8.33), line("601000", "D", 41.67)],
    });
    expect(reasons.some((r) => r.includes("66,99"))).toBe(true);
  });

  it("refuse une pièce sans justificatif", () => {
    expect(blockingReasons({ ...ok, hasDocument: false })[0]).toContain("justificatif");
  });

  it("refuse un exercice clos", () => {
    expect(blockingReasons({ ...ok, closedPeriod: true })[0]).toContain("clos");
  });

  it("refuse une pièce sans tiers ni date", () => {
    const reasons = blockingReasons({ ...ok, header: { ...AUCHAN, thirdPartyName: "  ", invoiceDate: "" } });
    expect(reasons).toHaveLength(2);
  });

  it("refuse un montant nul", () => {
    const reasons = blockingReasons({
      ...ok,
      header: { ...AUCHAN, amountTTC: 0 },
      lines: [line("401000", "C", 0)],
    });
    expect(reasons.some((r) => r.includes("montant"))).toBe(true);
  });
});

describe("l'intangibilité", () => {
  it("laisse modifier tant que la pièce n'est pas comptabilisée", () => {
    expect(canEdit("A_TRAITER")).toBe(true);
    expect(canEdit("ENREGISTREE")).toBe(true);
  });

  it("verrouille une pièce comptabilisée", () => {
    expect(canEdit("COMPTABILISEE")).toBe(false);
  });

  it("contre-passe en inversant chaque sens, sans rien changer d'autre", () => {
    const lines = [line("401000", "C", 66.99), line("445661", "D", 11.17), line("601000", "D", 55.82)];
    const reversed = reverseLines(lines);
    expect(reversed.map((l) => l.side)).toEqual(["D", "C", "C"]);
    expect(reversed.map((l) => l.amount)).toEqual([66.99, 11.17, 55.82]);
    expect(reversed.map((l) => l.accountCode)).toEqual(["401000", "445661", "601000"]);
    expect(isBalanced(reversed)).toBe(true);
  });
});

describe("le numéro de pièce", () => {
  it("s'écrit année, mois, puis six chiffres", () => {
    expect(pieceNumber("2025-12-04", 1)).toBe("202512000001");
    expect(pieceNumber("2025-12-31", 42)).toBe("202512000042");
    expect(pieceNumber("2026-01-02", 7)).toBe("202601000007");
  });
});

describe("le libellé par défaut", () => {
  it("reprend le tiers et la période, comme sur la capture", () => {
    expect(defaultLabel("Divers", "2025-12-04")).toBe("Divers - 12/25");
    expect(defaultLabel("Auchan", "2026-01-15")).toBe("Auchan - 01/26");
  });
});
