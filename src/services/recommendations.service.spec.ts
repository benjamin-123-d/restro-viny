import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/sales-analytics.service", () => ({ getSalesDashboard: vi.fn() }));
vi.mock("@/services/profit.service", () => ({ getProfitDashboard: vi.fn() }));
vi.mock("@/services/purchase-analytics.service", () => ({ getPurchaseDashboard: vi.fn() }));
vi.mock("@/services/stock.service", () => ({ listStock: vi.fn() }));
vi.mock("@/services/order.service", () => ({ listOrders: vi.fn() }));

import { getProfitDashboard } from "@/services/profit.service";
import { getPurchaseDashboard } from "@/services/purchase-analytics.service";
import { getSalesDashboard } from "@/services/sales-analytics.service";
import { listOrders } from "@/services/order.service";
import { listStock } from "@/services/stock.service";
import type { ProfitDashboardDTO } from "@/services/profit.service";
import type { PurchaseDashboardDTO } from "@/services/purchase-analytics.service";
import type { SalesDashboardDTO } from "@/services/sales-analytics.service";
import type { OrderDTO } from "@/types/order";
import type { StockItemDTO } from "@/types/inventory";
import { getRecommendations } from "./recommendations.service";

const ctx = { restaurantId: "res_1", userId: "u1" };
const NOW = new Date("2026-09-16T18:00:00.000Z");

// Only the fields the service actually reads are filled; the casts keep the
// fixtures short without letting `any` into the suite.
const salesDashboard = (
  daily: readonly { day: string; totalTTC: number; tickets: number }[],
  weekdayHours: readonly (readonly number[])[] = Array.from({ length: 7 }, () => [0]),
): SalesDashboardDTO =>
  ({ daily, heatmap: { cells: weekdayHours } }) as unknown as SalesDashboardDTO;

const profitDashboard = (
  ratio: number | null,
  extra: { coverage?: number | null; dishesWithoutCard?: number } = {},
): ProfitDashboardDTO =>
  ({
    margin: { ratio, coverage: extra.coverage ?? 100 },
    dishesWithoutCard: extra.dishesWithoutCard ?? 0,
    unsplitPurchaseCount: 0,
  }) as unknown as ProfitDashboardDTO;

const purchaseDashboard = (
  owed = { total: 0, overdue: 0, count: 0 },
  unsplitCount = 0,
): PurchaseDashboardDTO =>
  ({ owed, totals: { unsplitCount } }) as unknown as PurchaseDashboardDTO;

const stockItem = (name: string, isLow: boolean, isActive = true): StockItemDTO =>
  ({ id: name, name, isLow, isActive }) as unknown as StockItemDTO;

const openOrder = (createdAt: string): OrderDTO =>
  ({
    id: `o-${createdAt}`,
    createdAt,
    lines: [
      {
        unitPrice: 10,
        quantity: 2,
        taxRate: 10,
        taxInclusive: true,
        isComp: false,
        state: "FIRED",
        modifiers: [],
      },
    ],
  }) as unknown as OrderDTO;

const setup = (patch: {
  daily?: readonly { day: string; totalTTC: number; tickets: number }[];
  weekdayHours?: readonly (readonly number[])[];
  margin?: ProfitDashboardDTO;
  marginBefore?: ProfitDashboardDTO;
  purchases?: PurchaseDashboardDTO;
  stock?: readonly StockItemDTO[];
  orders?: readonly OrderDTO[];
} = {}): void => {
  vi.mocked(getSalesDashboard).mockResolvedValue(
    salesDashboard(
      patch.daily ?? [
        { day: "2026-09-15", totalTTC: 900, tickets: 40 },
        { day: "2026-09-16", totalTTC: 880, tickets: 39 },
      ],
      patch.weekdayHours,
    ),
  );
  vi.mocked(getProfitDashboard)
    .mockResolvedValueOnce(patch.margin ?? profitDashboard(30))
    .mockResolvedValueOnce(patch.marginBefore ?? profitDashboard(30));
  vi.mocked(getPurchaseDashboard).mockResolvedValue(patch.purchases ?? purchaseDashboard());
  vi.mocked(listStock).mockResolvedValue([...(patch.stock ?? [])]);
  vi.mocked(listOrders).mockResolvedValue([...(patch.orders ?? [])]);
};

describe("getRecommendations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("compare la journée en cours à la veille, les deux derniers points de la série", async () => {
    setup({
      daily: [
        { day: "2026-09-15", totalTTC: 900, tickets: 40 },
        { day: "2026-09-16", totalTTC: 450, tickets: 20 },
      ],
    });
    const list = await getRecommendations(ctx, NOW);
    const drop = list.find((r) => r.id === "ventes-en-baisse");
    expect(drop?.detail).toContain("450,00");
    expect(drop?.detail).toContain("900,00");
  });

  it("lit la marge de la semaine puis celle de la semaine précédente", async () => {
    setup({ margin: profitDashboard(38), marginBefore: profitDashboard(29) });
    const list = await getRecommendations(ctx, NOW);
    expect(list.find((r) => r.id === "marge-en-baisse")?.detail).toContain("38");
    // Le second appel demande la même fenêtre, décalée d'une semaine.
    const [, second] = vi.mocked(getProfitDashboard).mock.calls;
    expect(second[1]).toBe("7j");
    expect((second[2] as Date).getTime()).toBe(NOW.getTime() - 7 * 86_400_000);
  });

  it("additionne les heures de la heatmap pour trouver le jour creux", async () => {
    setup({
      weekdayHours: [[300, 300], [60, 60], [320, 320], [350, 350], [450, 450], [475, 475], [350, 350]],
    });
    expect((await getRecommendations(ctx, NOW)).find((r) => r.id === "jour-creux")?.detail).toContain("mardi");
  });

  it("ne retient que les articles actifs sous leur seuil", async () => {
    setup({
      stock: [
        stockItem("Poulet", true),
        stockItem("Tomates", true),
        stockItem("Sel", false),
        stockItem("Vieux stock", true, false),
      ],
    });
    const rec = (await getRecommendations(ctx, NOW)).find((r) => r.id === "stock-bas");
    expect(rec?.detail).toContain("Deux ingrédients");
    expect(rec?.detail).toContain("Poulet, Tomates");
    expect(rec?.detail).not.toContain("Vieux stock");
  });

  it("chiffre les tickets ouverts et l'attente du plus ancien", async () => {
    setup({
      orders: [
        openOrder(new Date(NOW.getTime() - 150 * 60_000).toISOString()),
        openOrder(new Date(NOW.getTime() - 20 * 60_000).toISOString()),
      ],
    });
    const rec = (await getRecommendations(ctx, NOW)).find((r) => r.id === "tickets-ouverts");
    expect(rec?.detail).toContain("Deux tickets");
    expect(rec?.detail).toContain("2 h 30");
    expect(rec?.detail).toContain("40,00");
  });

  it("remonte les factures fournisseurs échues", async () => {
    setup({ purchases: purchaseDashboard({ total: 800, overdue: 250, count: 3 }) });
    expect((await getRecommendations(ctx, NOW)).find((r) => r.id === "factures-echues")?.detail).toContain("250,00");
  });

  it("ne rend jamais une liste vide", async () => {
    setup();
    expect((await getRecommendations(ctx, NOW)).length).toBeGreaterThan(0);
  });
});
