"use server";

/**
 * Selling: customers and the ERPNext sales chain — Quotation → Sales Order →
 * Delivery Note → Sales Invoice → Customer Payment.
 */

import { withPermission } from "@/actions/helpers";
import {
  createCustomerGroupSchema,
  createCustomerPaymentSchema,
  createCustomerSchema,
  createDeliveryNoteSchema,
  createSalesInvoiceSchema,
  createSalesOrderSchema,
  createSalesQuotationSchema,
  createTerritorySchema,
  entityIdSchema,
  holdSalesOrderSchema,
  markQuotationLostSchema,
  orderFromQuotationSchema,
  updateCustomerGroupSchema,
  updateCustomerSchema,
  updateSalesOrderSchema,
  updateSalesQuotationSchema,
  updateTerritorySchema,
} from "@/lib/validators/selling";
import {
  createCustomer,
  createCustomerGroup,
  createTerritory,
  deleteCustomer,
  deleteCustomerGroup,
  deleteTerritory,
  updateCustomer,
  updateCustomerGroup,
  updateTerritory,
} from "@/services/customer.service";
import {
  cancelDeliveryNote,
  cancelSalesInvoice,
  cancelSalesOrder,
  cancelSalesQuotation,
  closeSalesOrder,
  createCustomerPayment,
  createDeliveryNote,
  createSalesInvoice,
  createSalesOrder,
  createSalesQuotation,
  deleteDeliveryNote,
  deleteSalesInvoice,
  deleteSalesOrder,
  deleteSalesQuotation,
  holdSalesOrder,
  markQuotationLost,
  orderFromQuotation,
  removeCustomerPayment,
  submitDeliveryNote,
  submitSalesInvoice,
  submitSalesOrder,
  submitSalesQuotation,
  updateSalesOrder,
  updateSalesQuotation,
} from "@/services/sales.document.service";

// Customers, groups and territories.
export const createCustomerAction = withPermission(
  "SELLING",
  "EDIT",
  createCustomerSchema,
  (data, ctx) => createCustomer(ctx, data),
);
export const updateCustomerAction = withPermission(
  "SELLING",
  "EDIT",
  updateCustomerSchema,
  (data, ctx) => updateCustomer(ctx, data),
);
export const deleteCustomerAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => deleteCustomer(ctx, data),
);
export const createCustomerGroupAction = withPermission(
  "SELLING",
  "EDIT",
  createCustomerGroupSchema,
  (data, ctx) => createCustomerGroup(ctx, data),
);
export const updateCustomerGroupAction = withPermission(
  "SELLING",
  "EDIT",
  updateCustomerGroupSchema,
  (data, ctx) => updateCustomerGroup(ctx, data),
);
export const deleteCustomerGroupAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => deleteCustomerGroup(ctx, data),
);
export const createTerritoryAction = withPermission(
  "SELLING",
  "EDIT",
  createTerritorySchema,
  (data, ctx) => createTerritory(ctx, data),
);
export const updateTerritoryAction = withPermission(
  "SELLING",
  "EDIT",
  updateTerritorySchema,
  (data, ctx) => updateTerritory(ctx, data),
);
export const deleteTerritoryAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => deleteTerritory(ctx, data),
);

// Quotations.
export const createSalesQuotationAction = withPermission(
  "SELLING",
  "EDIT",
  createSalesQuotationSchema,
  (data, ctx) => createSalesQuotation(ctx, data),
);
export const updateSalesQuotationAction = withPermission(
  "SELLING",
  "EDIT",
  updateSalesQuotationSchema,
  (data, ctx) => updateSalesQuotation(ctx, data),
);
export const submitSalesQuotationAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => submitSalesQuotation(ctx, data),
);
export const markQuotationLostAction = withPermission(
  "SELLING",
  "EDIT",
  markQuotationLostSchema,
  (data, ctx) => markQuotationLost(ctx, data),
);
export const cancelSalesQuotationAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => cancelSalesQuotation(ctx, data),
);
export const deleteSalesQuotationAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => deleteSalesQuotation(ctx, data),
);

// Sales orders — creation is gated on the customer's credit limit.
export const createSalesOrderAction = withPermission(
  "SELLING",
  "EDIT",
  createSalesOrderSchema,
  (data, ctx) => createSalesOrder(ctx, data),
);
export const updateSalesOrderAction = withPermission(
  "SELLING",
  "EDIT",
  updateSalesOrderSchema,
  (data, ctx) => updateSalesOrder(ctx, data),
);
export const submitSalesOrderAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => submitSalesOrder(ctx, data),
);
export const holdSalesOrderAction = withPermission(
  "SELLING",
  "EDIT",
  holdSalesOrderSchema,
  (data, ctx) => holdSalesOrder(ctx, data),
);
export const closeSalesOrderAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => closeSalesOrder(ctx, data),
);
export const cancelSalesOrderAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => cancelSalesOrder(ctx, data),
);
export const deleteSalesOrderAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => deleteSalesOrder(ctx, data),
);
export const orderFromQuotationAction = withPermission(
  "SELLING",
  "EDIT",
  orderFromQuotationSchema,
  (data, ctx) => orderFromQuotation(ctx, data),
);

// Delivery notes — submission issues stock from the shipping warehouse.
export const createDeliveryNoteAction = withPermission(
  "SELLING",
  "EDIT",
  createDeliveryNoteSchema,
  (data, ctx) => createDeliveryNote(ctx, data),
);
export const submitDeliveryNoteAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => submitDeliveryNote(ctx, data),
);
export const cancelDeliveryNoteAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => cancelDeliveryNote(ctx, data),
);
export const deleteDeliveryNoteAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => deleteDeliveryNote(ctx, data),
);

// Sales invoices and receipts.
export const createSalesInvoiceAction = withPermission(
  "SELLING",
  "EDIT",
  createSalesInvoiceSchema,
  (data, ctx) => createSalesInvoice(ctx, data),
);
export const submitSalesInvoiceAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => submitSalesInvoice(ctx, data),
);
export const cancelSalesInvoiceAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => cancelSalesInvoice(ctx, data),
);
export const deleteSalesInvoiceAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => deleteSalesInvoice(ctx, data),
);
export const createCustomerPaymentAction = withPermission(
  "SELLING",
  "EDIT",
  createCustomerPaymentSchema,
  (data, ctx) => createCustomerPayment(ctx, data),
);
export const removeCustomerPaymentAction = withPermission(
  "SELLING",
  "EDIT",
  entityIdSchema,
  (data, ctx) => removeCustomerPayment(ctx, data),
);
