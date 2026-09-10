import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/supplier-scorecard.repository", () => ({
  findScorecardFacts: vi.fn(),
  findScorecards: vi.fn(),
  upsertScorecard: vi.fn(),
}));
vi.mock("@/services/supplier.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/supplier.service")
  >("@/services/supplier.service");
  return { ...actual, loadOwnedSupplier: vi.fn() };
});

import {
  findScorecardFacts,
  upsertScorecard,
} from "@/repositories/supplier-scorecard.repository";
import { loadOwnedSupplier } from "@/services/supplier.service";

import {
  bandFor,
  compositeScore,
  generateScorecard,
  priceScoreFor,
} from "./supplier-scorecard.service";

const ctx = { restaurantId: "res_1", userId: "u1" };
const supplier = { id: "sup_1", restaurantId: "res_1", name: "Metro" } as never;

const day = (d: string) => new Date(`2026-${d}T00:00:00Z`);

const input = {
  supplierId: "sup_1",
  periodStart: day("06-01"),
  periodEnd: day("06-30"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadOwnedSupplier).mockResolvedValue(supplier);
  vi.mocked(upsertScorecard).mockImplementation(
    async (_window, data) =>
      ({
        id: "sc_1",
        supplierId: "sup_1",
        supplier: { name: "Metro" },
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        generatedAt: new Date(),
        ...data,
      }) as never,
  );
});

describe("bandFor", () => {
  it("bands a score onto the ERPNext-style standings", () => {
    expect(bandFor(95)).toBe("EXCELLENT");
    expect(bandFor(90)).toBe("EXCELLENT");
    expect(bandFor(80)).toBe("VERY_GOOD");
    expect(bandFor(60)).toBe("GOOD");
    expect(bandFor(45)).toBe("AVERAGE");
    expect(bandFor(10)).toBe("POOR");
  });
});

describe("priceScoreFor", () => {
  it("is perfect when the bill matches the order", () => {
    expect(priceScoreFor(0)).toBe(100);
  });

  it("does not reward billing under the agreed price", () => {
    expect(priceScoreFor(-20)).toBe(100);
  });

  it("loses a point per percent of overcharge", () => {
    expect(priceScoreFor(15)).toBe(85);
  });

  it("bottoms out at zero rather than going negative", () => {
    expect(priceScoreFor(500)).toBe(0);
  });
});

describe("compositeScore", () => {
  it("weights on-time and quality above price", () => {
    expect(
      compositeScore({
        onTimeDeliveryPercent: 100,
        qualityAcceptedPercent: 100,
        priceVariancePercent: 0,
      }),
    ).toBe(100);
  });

  it("drops proportionally when deliveries run late", () => {
    // 50 * 0.4 + 100 * 0.4 + 100 * 0.2 = 80
    expect(
      compositeScore({
        onTimeDeliveryPercent: 50,
        qualityAcceptedPercent: 100,
        priceVariancePercent: 0,
      }),
    ).toBe(80);
  });
});

describe("generateScorecard", () => {
  const facts = (o: Partial<Parameters<typeof upsertScorecard>[1]> = {}) => o;
  void facts;

  it("gives a supplier with no history the benefit of the doubt", async () => {
    vi.mocked(findScorecardFacts).mockResolvedValue({
      orders: [],
      receipts: [],
      invoicedTotal: 0,
    });

    const card = await generateScorecard(ctx, input);

    expect(card.onTimeDeliveryPercent).toBe(100);
    expect(card.qualityAcceptedPercent).toBe(100);
    expect(card.priceVariancePercent).toBe(0);
    expect(card.score).toBe(100);
    expect(card.standing).toBe("EXCELLENT");
  });

  it("scores on-time delivery against the date the order promised", async () => {
    vi.mocked(findScorecardFacts).mockResolvedValue({
      orders: [],
      receipts: [
        {
          postingDate: day("06-05"),
          purchaseOrder: { scheduleDate: day("06-10") },
          items: [],
        },
        {
          postingDate: day("06-20"),
          purchaseOrder: { scheduleDate: day("06-10") },
          items: [],
        },
      ],
      invoicedTotal: 0,
    } as never);

    const card = await generateScorecard(ctx, input);

    expect(card.onTimeDeliveryPercent).toBe(50);
  });

  it("ignores receipts whose order never promised a date", async () => {
    vi.mocked(findScorecardFacts).mockResolvedValue({
      orders: [],
      receipts: [
        { postingDate: day("06-20"), purchaseOrder: null, items: [] },
      ],
      invoicedTotal: 0,
    } as never);

    const card = await generateScorecard(ctx, input);

    expect(card.onTimeDeliveryPercent).toBe(100);
  });

  it("scores quality on what was kept versus what turned up", async () => {
    vi.mocked(findScorecardFacts).mockResolvedValue({
      orders: [],
      receipts: [
        {
          postingDate: day("06-05"),
          purchaseOrder: null,
          items: [{ quantity: 90, rejectedQuantity: 10 }],
        },
      ],
      invoicedTotal: 0,
    } as never);

    const card = await generateScorecard(ctx, input);

    expect(card.qualityAcceptedPercent).toBe(90);
  });

  it("reports overbilling as a positive price variance", async () => {
    vi.mocked(findScorecardFacts).mockResolvedValue({
      orders: [{ grandTotal: 1000 }],
      receipts: [],
      invoicedTotal: 1100,
    } as never);

    const card = await generateScorecard(ctx, input);

    expect(card.priceVariancePercent).toBe(10);
  });

  it("counts the orders and receipts behind the score", async () => {
    vi.mocked(findScorecardFacts).mockResolvedValue({
      orders: [{ grandTotal: 500 }, { grandTotal: 500 }],
      receipts: [
        { postingDate: day("06-05"), purchaseOrder: null, items: [] },
      ],
      invoicedTotal: 1000,
    } as never);

    const card = await generateScorecard(ctx, input);

    expect(card.totalOrders).toBe(2);
    expect(card.totalReceipts).toBe(1);
    expect(card.totalPurchaseAmount).toBe(1000);
  });

  it("refuses a supplier from another restaurant", async () => {
    vi.mocked(loadOwnedSupplier).mockRejectedValue(
      new Error("SUPPLIER_NOT_FOUND"),
    );

    await expect(generateScorecard(ctx, input)).rejects.toThrow(
      "SUPPLIER_NOT_FOUND",
    );
    expect(findScorecardFacts).not.toHaveBeenCalled();
  });
});
