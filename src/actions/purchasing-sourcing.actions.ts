"use server";

/**
 * Sourcing half of purchasing: requests for quotation, supplier quotations and
 * supplier scorecards. Kept apart from `purchasing.actions.ts` (which covers
 * ordering, receiving, billing and paying) so neither file becomes a dumping
 * ground.
 */

import { withPermission } from "@/actions/helpers";
import {
  createOrderFromQuotationSchema,
  createRfqSchema,
  createSupplierQuotationSchema,
  generateScorecardSchema,
  markRfqSentSchema,
  rfqIdSchema,
  supplierQuotationIdSchema,
  updateRfqSchema,
  updateSupplierQuotationSchema,
} from "@/lib/validators/purchasing";
import {
  cancelRfq,
  cancelSupplierQuotation,
  createOrderFromQuotation,
  createRfq,
  createSupplierQuotation,
  deleteRfq,
  deleteSupplierQuotation,
  markRfqSent,
  submitRfq,
  submitSupplierQuotation,
  updateRfq,
  updateSupplierQuotation,
} from "@/services/rfq.service";
import { generateScorecard } from "@/services/supplier-scorecard.service";

// Requests for quotation — every invited supplier must accept RFQs.
export const createRfqAction = withPermission(
  "PURCHASING",
  "EDIT",
  createRfqSchema,
  (data, ctx) => createRfq(ctx, data),
);
export const updateRfqAction = withPermission(
  "PURCHASING",
  "EDIT",
  updateRfqSchema,
  (data, ctx) => updateRfq(ctx, data),
);
export const submitRfqAction = withPermission(
  "PURCHASING",
  "EDIT",
  rfqIdSchema,
  (data, ctx) => submitRfq(ctx, data),
);
export const cancelRfqAction = withPermission(
  "PURCHASING",
  "EDIT",
  rfqIdSchema,
  (data, ctx) => cancelRfq(ctx, data),
);
export const deleteRfqAction = withPermission(
  "PURCHASING",
  "EDIT",
  rfqIdSchema,
  (data, ctx) => deleteRfq(ctx, data),
);
export const markRfqSentAction = withPermission(
  "PURCHASING",
  "EDIT",
  markRfqSentSchema,
  (data, ctx) => markRfqSent(ctx, data),
);

// Supplier quotations — the priced answers an RFQ is compared on.
export const createSupplierQuotationAction = withPermission(
  "PURCHASING",
  "EDIT",
  createSupplierQuotationSchema,
  (data, ctx) => createSupplierQuotation(ctx, data),
);
export const updateSupplierQuotationAction = withPermission(
  "PURCHASING",
  "EDIT",
  updateSupplierQuotationSchema,
  (data, ctx) => updateSupplierQuotation(ctx, data),
);
export const submitSupplierQuotationAction = withPermission(
  "PURCHASING",
  "EDIT",
  supplierQuotationIdSchema,
  (data, ctx) => submitSupplierQuotation(ctx, data),
);
export const cancelSupplierQuotationAction = withPermission(
  "PURCHASING",
  "EDIT",
  supplierQuotationIdSchema,
  (data, ctx) => cancelSupplierQuotation(ctx, data),
);
export const deleteSupplierQuotationAction = withPermission(
  "PURCHASING",
  "EDIT",
  supplierQuotationIdSchema,
  (data, ctx) => deleteSupplierQuotation(ctx, data),
);

/** Award the business: turn an accepted quote into a purchase order. */
export const createOrderFromQuotationAction = withPermission(
  "PURCHASING",
  "EDIT",
  createOrderFromQuotationSchema,
  (data, ctx) => createOrderFromQuotation(ctx, data),
);

// Scorecards are recomputed from purchase history on demand.
export const generateScorecardAction = withPermission(
  "PURCHASING",
  "EDIT",
  generateScorecardSchema,
  (data, ctx) => generateScorecard(ctx, data),
);
