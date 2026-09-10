"use server";

import { withPermission } from "@/actions/helpers";
import {
  createPurchaseOrderSchema,
  createPurchaseInvoiceSchema,
  createSupplierPaymentSchema,
  createPurchaseReceiptSchema,
  createSupplierGroupSchema,
  createSupplierSchema,
  deleteSupplierGroupSchema,
  deleteSupplierSchema,
  holdPurchaseOrderSchema,
  purchaseOrderIdSchema,
  purchaseInvoiceIdSchema,
  supplierPaymentIdSchema,
  purchaseReceiptIdSchema,
  setSupplierHoldSchema,
  updatePurchaseOrderSchema,
  updateSupplierGroupSchema,
  updateSupplierSchema,
} from "@/lib/validators/purchasing";
import {
  cancelPurchaseOrder,
  closePurchaseOrder,
  createPurchaseOrder,
  deletePurchaseOrder,
  holdPurchaseOrder,
  reopenPurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
} from "@/services/purchase-order.service";
import {
  cancelPurchaseInvoice,
  createPurchaseInvoice,
  deletePurchaseInvoice,
  submitPurchaseInvoice,
} from "@/services/purchase-invoice.service";
import {
  cancelPurchaseReceipt,
  createPurchaseReceipt,
  deletePurchaseReceipt,
  submitPurchaseReceipt,
} from "@/services/purchase-receipt.service";
import {
  createSupplierPayment,
  removeSupplierPayment,
} from "@/services/supplier-payment.service";
import {
  createSupplier,
  createSupplierGroup,
  deleteSupplier,
  deleteSupplierGroup,
  setSupplierHold,
  updateSupplier,
  updateSupplierGroup,
} from "@/services/supplier.service";

// Supplier master data
export const createSupplierAction = withPermission(
  "PURCHASING",
  "EDIT",
  createSupplierSchema,
  (data, ctx) => createSupplier(ctx, data),
);
export const updateSupplierAction = withPermission(
  "PURCHASING",
  "EDIT",
  updateSupplierSchema,
  (data, ctx) => updateSupplier(ctx, data),
);
export const deleteSupplierAction = withPermission(
  "PURCHASING",
  "EDIT",
  deleteSupplierSchema,
  (data, ctx) => deleteSupplier(ctx, data),
);
export const setSupplierHoldAction = withPermission(
  "PURCHASING",
  "EDIT",
  setSupplierHoldSchema,
  (data, ctx) => setSupplierHold(ctx, data),
);
export const createSupplierGroupAction = withPermission(
  "PURCHASING",
  "EDIT",
  createSupplierGroupSchema,
  (data, ctx) => createSupplierGroup(ctx, data),
);
export const updateSupplierGroupAction = withPermission(
  "PURCHASING",
  "EDIT",
  updateSupplierGroupSchema,
  (data, ctx) => updateSupplierGroup(ctx, data),
);
export const deleteSupplierGroupAction = withPermission(
  "PURCHASING",
  "EDIT",
  deleteSupplierGroupSchema,
  (data, ctx) => deleteSupplierGroup(ctx, data),
);

// Purchase-order lifecycle
export const createPurchaseOrderAction = withPermission(
  "PURCHASING",
  "EDIT",
  createPurchaseOrderSchema,
  (data, ctx) => createPurchaseOrder(ctx, data),
);
export const updatePurchaseOrderAction = withPermission(
  "PURCHASING",
  "EDIT",
  updatePurchaseOrderSchema,
  (data, ctx) => updatePurchaseOrder(ctx, data),
);
export const submitPurchaseOrderAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseOrderIdSchema,
  (data, ctx) => submitPurchaseOrder(ctx, data),
);
export const holdPurchaseOrderAction = withPermission(
  "PURCHASING",
  "EDIT",
  holdPurchaseOrderSchema,
  (data, ctx) => holdPurchaseOrder(ctx, data),
);
export const closePurchaseOrderAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseOrderIdSchema,
  (data, ctx) => closePurchaseOrder(ctx, data),
);
export const reopenPurchaseOrderAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseOrderIdSchema,
  (data, ctx) => reopenPurchaseOrder(ctx, data),
);
export const cancelPurchaseOrderAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseOrderIdSchema,
  (data, ctx) => cancelPurchaseOrder(ctx, data),
);
export const deletePurchaseOrderAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseOrderIdSchema,
  (data, ctx) => deletePurchaseOrder(ctx, data),
);

// Goods receipts — submission updates the existing stock ledger atomically.
export const createPurchaseReceiptAction = withPermission(
  "PURCHASING",
  "EDIT",
  createPurchaseReceiptSchema,
  (data, ctx) => createPurchaseReceipt(ctx, data),
);
export const submitPurchaseReceiptAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseReceiptIdSchema,
  (data, ctx) => submitPurchaseReceipt(ctx, data),
);
export const cancelPurchaseReceiptAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseReceiptIdSchema,
  (data, ctx) => cancelPurchaseReceipt(ctx, data),
);
export const deletePurchaseReceiptAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseReceiptIdSchema,
  (data, ctx) => deletePurchaseReceipt(ctx, data),
);

// Supplier bills — can optionally receive stock only when no receipt exists.
export const createPurchaseInvoiceAction = withPermission(
  "PURCHASING",
  "EDIT",
  createPurchaseInvoiceSchema,
  (data, ctx) => createPurchaseInvoice(ctx, data),
);
export const submitPurchaseInvoiceAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseInvoiceIdSchema,
  (data, ctx) => submitPurchaseInvoice(ctx, data),
);
export const cancelPurchaseInvoiceAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseInvoiceIdSchema,
  (data, ctx) => cancelPurchaseInvoice(ctx, data),
);
export const deletePurchaseInvoiceAction = withPermission(
  "PURCHASING",
  "EDIT",
  purchaseInvoiceIdSchema,
  (data, ctx) => deletePurchaseInvoice(ctx, data),
);

// Payments are allocated only to open bills of the selected supplier.
export const createSupplierPaymentAction = withPermission(
  "PURCHASING",
  "EDIT",
  createSupplierPaymentSchema,
  (data, ctx) => createSupplierPayment(ctx, data),
);
export const removeSupplierPaymentAction = withPermission(
  "PURCHASING",
  "EDIT",
  supplierPaymentIdSchema,
  (data, ctx) => removeSupplierPayment(ctx, data),
);
