"use server";

/**
 * Sourcing half of purchasing: requests for quotation, supplier quotations and
 * supplier scorecards. Kept apart from `purchasing.actions.ts` (which covers
 * ordering, receiving, billing and paying) so neither file becomes a dumping
 * ground.
 */

import { withManagerValidation } from "@/actions/helpers";
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
export const createRfqAction = withManagerValidation(
  createRfqSchema,
  (data, ctx) => createRfq(ctx, data),
);
export const updateRfqAction = withManagerValidation(
  updateRfqSchema,
  (data, ctx) => updateRfq(ctx, data),
);
export const submitRfqAction = withManagerValidation(
  rfqIdSchema,
  (data, ctx) => submitRfq(ctx, data),
);
export const cancelRfqAction = withManagerValidation(
  rfqIdSchema,
  (data, ctx) => cancelRfq(ctx, data),
);
export const deleteRfqAction = withManagerValidation(
  rfqIdSchema,
  (data, ctx) => deleteRfq(ctx, data),
);
export const markRfqSentAction = withManagerValidation(
  markRfqSentSchema,
  (data, ctx) => markRfqSent(ctx, data),
);

// Supplier quotations — the priced answers an RFQ is compared on.
export const createSupplierQuotationAction = withManagerValidation(
  createSupplierQuotationSchema,
  (data, ctx) => createSupplierQuotation(ctx, data),
);
export const updateSupplierQuotationAction = withManagerValidation(
  updateSupplierQuotationSchema,
  (data, ctx) => updateSupplierQuotation(ctx, data),
);
export const submitSupplierQuotationAction = withManagerValidation(
  supplierQuotationIdSchema,
  (data, ctx) => submitSupplierQuotation(ctx, data),
);
export const cancelSupplierQuotationAction = withManagerValidation(
  supplierQuotationIdSchema,
  (data, ctx) => cancelSupplierQuotation(ctx, data),
);
export const deleteSupplierQuotationAction = withManagerValidation(
  supplierQuotationIdSchema,
  (data, ctx) => deleteSupplierQuotation(ctx, data),
);

/** Award the business: turn an accepted quote into a purchase order. */
export const createOrderFromQuotationAction = withManagerValidation(
  createOrderFromQuotationSchema,
  (data, ctx) => createOrderFromQuotation(ctx, data),
);

// Scorecards are recomputed from purchase history on demand.
export const generateScorecardAction = withManagerValidation(
  generateScorecardSchema,
  (data, ctx) => generateScorecard(ctx, data),
);
