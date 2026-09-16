import { describe, expect, it } from "vitest";

import {
  actionableCount,
  buildRecommendations,
  type RecommendationInput,
} from "./recommendations";

/**
 * A restaurant where nothing is wrong: stock above the thresholds, no invoice
 * left to pay, every ticket cashed in, steady margin and steady takings.
 */
const HEALTHY: RecommendationInput = {
  revenueToday: 900,
  revenueYesterday: 880,
  ticketsToday: 42,
  averageTicketToday: 21.4,
  marginRatio: 29,
  previousMarginRatio: 29.5,
  marginCoverage: 100,
  dishesWithoutCard: 0,
  lowStockCount: 0,
  lowStockNames: [],
  openTicketCount: 0,
  openTicketTotal: 0,
  oldestOpenTicketMinutes: null,
  supplierDue: { total: 0, overdue: 0, count: 0 },
  unsplitPurchaseCount: 0,
  weekdayRevenue: [600, 620, 590, 700, 900, 950, 640],
  marginPeriodLabel: "7 derniers jours",
};

const withInput = (patch: Partial<RecommendationInput>): RecommendationInput => ({
  ...HEALTHY,
  ...patch,
});

const byId = (input: RecommendationInput, id: string) =>
  buildRecommendations(input).find((r) => r.id === id);

describe("buildRecommendations — le panneau n'est jamais vide", () => {
  it("félicite le restaurant quand rien ne coince", () => {
    const list = buildRecommendations(HEALTHY);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("tout-va-bien");
    expect(list[0].tone).toBe("bravo");
    expect(list[0].detail).toContain("Gardez le cap");
  });

  it("retire le message positif dès qu'un point demande une action", () => {
    const list = buildRecommendations(withInput({ lowStockCount: 2, lowStockNames: ["Poulet", "Tomates"] }));
    expect(list.some((r) => r.id === "tout-va-bien")).toBe(false);
    expect(list.some((r) => r.tone === "attention")).toBe(true);
  });

  it("garde le message positif quand il n'y a que des constats informatifs", () => {
    const list = buildRecommendations(withInput({ dishesWithoutCard: 4 }));
    expect(list.map((r) => r.id)).toContain("fiches-manquantes");
    expect(list.map((r) => r.id)).toContain("tout-va-bien");
  });
});

describe("buildRecommendations — stock", () => {
  it("nomme les ingrédients sous le seuil et dit quand commander", () => {
    const rec = byId(
      withInput({ lowStockCount: 3, lowStockNames: ["Poulet", "Tomates", "Huile"] }),
      "stock-bas",
    );
    expect(rec).toBeDefined();
    expect(rec?.tone).toBe("attention");
    expect(rec?.href).toBe("/dashboard/inventory");
    expect(rec?.detail).toContain("Trois ingrédients");
    expect(rec?.detail).toContain("Poulet");
    expect(rec?.detail).toContain("passez commande");
  });

  it("passe au singulier pour un seul ingrédient", () => {
    const rec = byId(withInput({ lowStockCount: 1, lowStockNames: ["Poulet"] }), "stock-bas");
    expect(rec?.detail).toContain("Poulet est sous son seuil");
    expect(rec?.detail).not.toContain("ingrédients");
  });

  it("ne cite que les trois premiers noms et compte le reste", () => {
    const rec = byId(
      withInput({
        lowStockCount: 5,
        lowStockNames: ["Poulet", "Tomates", "Huile", "Farine", "Beurre"],
      }),
      "stock-bas",
    );
    expect(rec?.detail).toContain("Poulet, Tomates, Huile");
    expect(rec?.detail).toContain("2 autres");
    expect(rec?.detail).not.toContain("Beurre");
  });
});

describe("buildRecommendations — marge", () => {
  it("alerte quand le ratio matière monte d'au moins deux points", () => {
    const rec = byId(withInput({ marginRatio: 36, previousMarginRatio: 29 }), "marge-en-baisse");
    expect(rec?.tone).toBe("attention");
    expect(rec?.detail).toContain("29");
    expect(rec?.detail).toContain("36");
    expect(rec?.detail).toContain("7 derniers jours");
    expect(rec?.href).toBe("/dashboard/statistics/benefices");
  });

  it("félicite quand le ratio matière redescend", () => {
    const rec = byId(withInput({ marginRatio: 28, previousMarginRatio: 35 }), "marge-en-hausse");
    expect(rec?.tone).toBe("bravo");
    expect(rec?.detail).toContain("28");
  });

  it("se tait quand la marge bouge à peine ou n'est pas connue", () => {
    expect(byId(withInput({ marginRatio: 30, previousMarginRatio: 29 }), "marge-en-baisse")).toBeUndefined();
    expect(byId(withInput({ marginRatio: null, previousMarginRatio: 29 }), "marge-en-baisse")).toBeUndefined();
    expect(byId(withInput({ marginRatio: 40, previousMarginRatio: null }), "marge-en-baisse")).toBeUndefined();
  });
});

describe("buildRecommendations — ventes", () => {
  it("alerte sur une forte baisse en citant les deux journées", () => {
    const rec = byId(withInput({ revenueToday: 450, revenueYesterday: 900 }), "ventes-en-baisse");
    expect(rec?.tone).toBe("attention");
    expect(rec?.detail).toContain("450,00");
    expect(rec?.detail).toContain("900,00");
    expect(rec?.detail).toContain("50");
  });

  it("félicite une forte hausse et invite à noter ce qui a marché", () => {
    const rec = byId(withInput({ revenueToday: 1350, revenueYesterday: 900 }), "ventes-en-hausse");
    expect(rec?.tone).toBe("bravo");
    expect(rec?.detail).toContain("50");
  });

  it("ne compare rien quand la veille était à zéro", () => {
    const list = buildRecommendations(withInput({ revenueToday: 900, revenueYesterday: 0 }));
    expect(list.some((r) => r.id.startsWith("ventes-"))).toBe(false);
  });
});

describe("buildRecommendations — fournisseurs", () => {
  it("met en avant les factures échues avec le montant et le geste à faire", () => {
    const rec = byId(
      withInput({ supplierDue: { total: 800, overdue: 250, count: 3 } }),
      "factures-echues",
    );
    expect(rec?.tone).toBe("attention");
    expect(rec?.detail).toContain("250,00");
    expect(rec?.detail).toContain("réglez");
    expect(rec?.href).toBe("/dashboard/purchasing/invoices");
  });

  it("reste informatif quand rien n'est encore échu", () => {
    const list = buildRecommendations(withInput({ supplierDue: { total: 800, overdue: 0, count: 2 } }));
    const rec = list.find((r) => r.id === "factures-a-payer");
    expect(rec?.tone).toBe("info");
    expect(list.some((r) => r.id === "factures-echues")).toBe(false);
  });
});

describe("buildRecommendations — tickets non encaissés", () => {
  it("alerte sur un ticket ouvert depuis trop longtemps", () => {
    const rec = byId(
      withInput({ openTicketCount: 1, openTicketTotal: 64, oldestOpenTicketMinutes: 135 }),
      "tickets-ouverts",
    );
    expect(rec?.tone).toBe("attention");
    expect(rec?.detail).toContain("2 h 15");
    expect(rec?.detail).toContain("encaissez");
  });

  it("compte les tickets et leur montant quand il y en a plusieurs", () => {
    const rec = byId(
      withInput({ openTicketCount: 3, openTicketTotal: 320, oldestOpenTicketMinutes: 100 }),
      "tickets-ouverts",
    );
    expect(rec?.detail).toContain("Trois tickets");
    expect(rec?.detail).toContain("320,00");
  });

  it("laisse tranquille un service en cours", () => {
    expect(
      byId(withInput({ openTicketCount: 4, openTicketTotal: 210, oldestOpenTicketMinutes: 25 }), "tickets-ouverts"),
    ).toBeUndefined();
  });
});

describe("buildRecommendations — jour creux", () => {
  it("désigne le jour le plus faible de la semaine et propose quoi en faire", () => {
    const rec = byId(
      withInput({ weekdayRevenue: [600, 120, 640, 700, 900, 950, 700] }),
      "jour-creux",
    );
    expect(rec?.tone).toBe("info");
    expect(rec?.detail).toContain("mardi");
    expect(rec?.detail).toContain("testez");
  });

  it("ignore les jours de fermeture plutôt que de conseiller d'ouvrir", () => {
    const rec = byId(
      withInput({ weekdayRevenue: [0, 0, 640, 700, 900, 950, 700] }),
      "jour-creux",
    );
    expect(rec).toBeUndefined();
  });

  it("ne conclut rien sur moins de trois jours d'ouverture", () => {
    expect(byId(withInput({ weekdayRevenue: [0, 0, 0, 0, 900, 50, 0] }), "jour-creux")).toBeUndefined();
  });
});

describe("buildRecommendations — mise en forme", () => {
  const STRUGGLING: RecommendationInput = withInput({
    revenueToday: 450,
    revenueYesterday: 900,
    marginRatio: 38,
    previousMarginRatio: 29,
    marginCoverage: 60,
    dishesWithoutCard: 5,
    lowStockCount: 3,
    lowStockNames: ["Poulet", "Tomates", "Huile"],
    openTicketCount: 2,
    openTicketTotal: 180,
    oldestOpenTicketMinutes: 150,
    supplierDue: { total: 800, overdue: 250, count: 3 },
    unsplitPurchaseCount: 2,
    weekdayRevenue: [600, 120, 640, 700, 900, 950, 700],
  });

  it("trie de l'urgent au secondaire", () => {
    const list = buildRecommendations(STRUGGLING);
    const priorities = list.map((r) => r.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
    expect(list[0].id).toBe("tickets-ouverts");
  });

  it("dit toujours le constat puis le geste à faire, en une phrase finie", () => {
    for (const rec of [...buildRecommendations(STRUGGLING), ...buildRecommendations(HEALTHY)]) {
      expect(rec.title.length).toBeGreaterThan(0);
      // « constat : action » — jamais un simple libellé comme « Stock bas ».
      expect(rec.detail).toMatch(/\S : \S/);
      expect(rec.detail.trim().endsWith(".")).toBe(true);
    }
  });

  it("garde le panneau lisible en plafonnant la liste", () => {
    expect(buildRecommendations(STRUGGLING).length).toBeLessThanOrEqual(6);
  });

  it("ne rend jamais deux fois le même identifiant", () => {
    const ids = buildRecommendations(STRUGGLING).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("actionableCount", () => {
  it("ne compte que ce qui demande une action", () => {
    expect(actionableCount(buildRecommendations(HEALTHY))).toBe(0);
    const list = buildRecommendations(
      withInput({
        lowStockCount: 1,
        lowStockNames: ["Poulet"],
        supplierDue: { total: 800, overdue: 250, count: 3 },
        dishesWithoutCard: 4,
      }),
    );
    expect(actionableCount(list)).toBe(2);
  });
});
