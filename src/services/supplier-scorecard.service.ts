import type { ScorecardStanding } from "@/generated/prisma/client";
import type { GenerateScorecardInput } from "@/lib/validators/purchasing";
import {
  findScorecardFacts,
  findScorecards,
  upsertScorecard,
  type ScorecardWithSupplier,
} from "@/repositories/supplier-scorecard.repository";
import {
  loadOwnedSupplier,
  type PurchasingContext,
} from "@/services/supplier.service";
import type { SupplierScorecardDTO } from "@/types/purchasing";

/**
 * ERPNext scores suppliers from hand-maintained criteria, variables and
 * weightings. V Suite derives the three things a restaurant actually cares about
 * straight from its own purchase history, so a scorecard is never stale and
 * never needs configuring:
 *
 *   · on-time delivery — receipts posted by the date the order promised
 *   · quality          — accepted quantity as a share of everything delivered
 *   · price            — what was invoiced against what was ordered
 */
const WEIGHTS = { onTime: 0.4, quality: 0.4, price: 0.2 } as const;

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const bandFor = (score: number): ScorecardStanding => {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "VERY_GOOD";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "AVERAGE";
  return "POOR";
};

/**
 * Turn a price variance into a 0-100 score. Billing under the agreed price is
 * not "better than perfect" — it caps at 100 — while overcharging falls away
 * point for point.
 */
export const priceScoreFor = (variancePercent: number): number =>
  Math.max(0, Math.min(100, 100 - Math.max(0, variancePercent)));

export const compositeScore = (input: {
  onTimeDeliveryPercent: number;
  qualityAcceptedPercent: number;
  priceVariancePercent: number;
}): number =>
  round2(
    input.onTimeDeliveryPercent * WEIGHTS.onTime +
      input.qualityAcceptedPercent * WEIGHTS.quality +
      priceScoreFor(input.priceVariancePercent) * WEIGHTS.price,
  );

const mapScorecard = (row: ScorecardWithSupplier): SupplierScorecardDTO => ({
  id: row.id,
  supplierId: row.supplierId,
  supplierName: row.supplier.name,
  periodStart: row.periodStart.toISOString(),
  periodEnd: row.periodEnd.toISOString(),
  onTimeDeliveryPercent: Number(row.onTimeDeliveryPercent),
  qualityAcceptedPercent: Number(row.qualityAcceptedPercent),
  priceVariancePercent: Number(row.priceVariancePercent),
  totalOrders: row.totalOrders,
  totalReceipts: row.totalReceipts,
  totalPurchaseAmount: Number(row.totalPurchaseAmount),
  score: Number(row.score),
  standing: row.standing,
  generatedAt: row.generatedAt.toISOString(),
});

/**
 * Build (and store) a supplier's scorecard for a window. With no history in the
 * window the supplier is given the benefit of the doubt — 100% on time and on
 * quality — rather than being scored badly for an absence of evidence.
 */
export const generateScorecard = async (
  ctx: PurchasingContext,
  input: GenerateScorecardInput,
): Promise<SupplierScorecardDTO> => {
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  const window = {
    restaurantId: ctx.restaurantId,
    supplierId: supplier.id,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  };
  const facts = await findScorecardFacts(window);

  // On-time: only receipts whose order actually promised a date can be judged.
  const datedReceipts = facts.receipts.filter(
    (r) => r.purchaseOrder?.scheduleDate != null,
  );
  const onTimeCount = datedReceipts.filter(
    (r) =>
      r.postingDate.getTime() <=
      (r.purchaseOrder?.scheduleDate as Date).getTime(),
  ).length;
  const onTimeDeliveryPercent =
    datedReceipts.length === 0
      ? 100
      : round2((onTimeCount / datedReceipts.length) * 100);

  // Quality: what was kept out of everything that turned up.
  let accepted = 0;
  let delivered = 0;
  for (const receipt of facts.receipts) {
    for (const item of receipt.items) {
      accepted += Number(item.quantity);
      delivered += Number(item.quantity) + Number(item.rejectedQuantity);
    }
  }
  const qualityAcceptedPercent =
    delivered === 0 ? 100 : round2((accepted / delivered) * 100);

  // Price: invoiced against ordered, as a signed percentage.
  const ordered = facts.orders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
  const priceVariancePercent =
    ordered === 0
      ? 0
      : round2(((facts.invoicedTotal - ordered) / ordered) * 100);

  const score = compositeScore({
    onTimeDeliveryPercent,
    qualityAcceptedPercent,
    priceVariancePercent,
  });

  return mapScorecard(
    await upsertScorecard(window, {
      onTimeDeliveryPercent,
      qualityAcceptedPercent,
      priceVariancePercent,
      totalOrders: facts.orders.length,
      totalReceipts: facts.receipts.length,
      totalPurchaseAmount: facts.invoicedTotal,
      score,
      standing: bandFor(score),
    }),
  );
};

export const listScorecards = async (
  ctx: PurchasingContext,
  supplierId?: string,
): Promise<SupplierScorecardDTO[]> =>
  (await findScorecards(ctx.restaurantId, supplierId)).map(mapScorecard);
