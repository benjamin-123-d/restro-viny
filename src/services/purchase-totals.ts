/**
 * Pure money and status math for purchasing documents. No IO — the same
 * functions price a quotation, an order, a receipt and a supplier bill, and
 * they are exhaustively unit-tested.
 *
 * This mirrors `billing.ts` on the sales side rather than extending it: the
 * sales bill carries POS-only concerns (comps, CGST/SGST split, tender
 * rounding) that a purchase document has no use for.
 */

export interface PurchaseLineInput {
  readonly quantity: number;
  readonly rate: number;
  /** Line-level discount, percent of gross. */
  readonly discountPercent: number | null;
  /** Tax applied to the discounted net, percent. */
  readonly taxRate: number;
}

export interface PurchaseLineResult {
  readonly gross: number;
  readonly discount: number;
  readonly net: number;
  readonly tax: number;
  readonly total: number;
}

export interface PurchaseTotals {
  readonly lines: readonly PurchaseLineResult[];
  /** Net of line discounts, before document discount and tax. */
  readonly subtotal: number;
  /** Sum of the line-level discounts. */
  readonly lineDiscountTotal: number;
  /** Document-level discount actually applied (never more than the subtotal). */
  readonly documentDiscount: number;
  readonly taxTotal: number;
  readonly roundOff: number;
  readonly grandTotal: number;
}

export interface PurchaseTotalsOptions {
  /** Flat amount off the whole document, spread pro rata across lines. */
  readonly documentDiscount?: number;
  /** Round the grand total to the nearest whole unit of currency. */
  readonly roundTotal?: boolean;
}

/** Money is carried to 2 decimals throughout. */
const money = (n: number): number => Math.round(n * 100) / 100;

const lineNet = (line: PurchaseLineInput): number => {
  const gross = line.quantity * line.rate;
  const discount = line.discountPercent
    ? (gross * line.discountPercent) / 100
    : 0;
  return gross - discount;
};

/**
 * Price every line, then apply the document discount pro rata to each line's
 * net so that tax is charged on what is actually payable — the order ERPNext
 * uses when `apply_discount_on` is the net total.
 */
export const computePurchaseTotals = (
  inputs: readonly PurchaseLineInput[],
  options: PurchaseTotalsOptions = {},
): PurchaseTotals => {
  const netTotal = inputs.reduce((sum, line) => sum + lineNet(line), 0);
  const requestedDiscount = Math.max(0, options.documentDiscount ?? 0);
  const documentDiscount = Math.min(requestedDiscount, netTotal);
  const discountRatio = netTotal > 0 ? documentDiscount / netTotal : 0;

  const lines = inputs.map((input): PurchaseLineResult => {
    const gross = input.quantity * input.rate;
    const discount = input.discountPercent
      ? (gross * input.discountPercent) / 100
      : 0;
    const net = gross - discount;
    const payable = net * (1 - discountRatio);
    const tax = (payable * input.taxRate) / 100;
    return {
      gross: money(gross),
      discount: money(discount),
      net: money(net),
      tax: money(tax),
      total: money(payable + tax),
    };
  });

  const lineDiscountTotal = money(
    lines.reduce((sum, l) => sum + l.discount, 0),
  );
  const taxTotal = money(lines.reduce((sum, l) => sum + l.tax, 0));
  const subtotal = money(netTotal);
  const payable = money(subtotal - money(documentDiscount) + taxTotal);
  const grandTotal = options.roundTotal ? Math.round(payable) : payable;

  return {
    lines,
    subtotal,
    lineDiscountTotal,
    documentDiscount: money(documentDiscount),
    taxTotal,
    roundOff: money(grandTotal - payable),
    grandTotal: money(grandTotal),
  };
};

/**
 * How complete something is, as a percentage capped at 100 — an over-receipt
 * is still just "fully received", never 120% done.
 */
export const percentOf = (done: number, total: number): number => {
  if (total <= 0) return 0;
  return money(Math.min(100, (done / total) * 100));
};

/** Lifecycle states a document is put into explicitly, by a person. */
export type PurchaseDocState =
  | "DRAFT"
  | "SUBMITTED"
  | "ON_HOLD"
  | "CLOSED"
  | "CANCELLED"
  | "RETURN";

export type PurchaseOrderStatusValue =
  | "DRAFT"
  | "ON_HOLD"
  | "TO_RECEIVE_AND_BILL"
  | "TO_RECEIVE"
  | "TO_BILL"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED";

/** Money comparisons tolerate sub-cent dust from pro-rata splits. */
const EPSILON = 0.01;

/**
 * The ERPNext purchase-order ladder. An explicit state (draft, hold, closed,
 * cancelled) always wins; otherwise the status is read off received/billed
 * progress.
 */
export const derivePurchaseOrderStatus = (input: {
  readonly state: PurchaseDocState;
  readonly receivedPercent: number;
  readonly billedPercent: number;
}): PurchaseOrderStatusValue => {
  if (input.state === "DRAFT") return "DRAFT";
  if (input.state === "CANCELLED") return "CANCELLED";
  if (input.state === "CLOSED") return "CLOSED";
  if (input.state === "ON_HOLD") return "ON_HOLD";

  const received = input.receivedPercent >= 100 - EPSILON;
  const billed = input.billedPercent >= 100 - EPSILON;
  if (received && billed) return "COMPLETED";
  if (received) return "TO_BILL";
  if (billed) return "TO_RECEIVE";
  return "TO_RECEIVE_AND_BILL";
};

export type PurchaseReceiptStatusValue =
  | "DRAFT"
  | "TO_BILL"
  | "PARTLY_BILLED"
  | "COMPLETED"
  | "RETURN"
  | "CLOSED"
  | "CANCELLED";

export const derivePurchaseReceiptStatus = (input: {
  readonly state: PurchaseDocState;
  readonly billedPercent: number;
}): PurchaseReceiptStatusValue => {
  if (input.state === "DRAFT") return "DRAFT";
  if (input.state === "CANCELLED") return "CANCELLED";
  if (input.state === "CLOSED") return "CLOSED";
  if (input.state === "RETURN") return "RETURN";

  if (input.billedPercent >= 100 - EPSILON) return "COMPLETED";
  if (input.billedPercent > 0) return "PARTLY_BILLED";
  return "TO_BILL";
};

export type PurchaseInvoiceStatusValue =
  | "DRAFT"
  | "UNPAID"
  | "PARTLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "RETURN"
  | "DEBIT_NOTE_ISSUED"
  | "CANCELLED";

/**
 * Supplier-bill status. Settlement beats the calendar: a bill paid in full is
 * never reported as overdue, however late the payment landed.
 */
export const derivePurchaseInvoiceStatus = (input: {
  readonly state: PurchaseDocState;
  readonly grandTotal: number;
  readonly paidAmount: number;
  readonly dueDate: Date;
  readonly now: Date;
}): PurchaseInvoiceStatusValue => {
  if (input.state === "DRAFT") return "DRAFT";
  if (input.state === "CANCELLED") return "CANCELLED";
  if (input.state === "RETURN") return "RETURN";

  const outstanding = input.grandTotal - input.paidAmount;
  if (outstanding <= EPSILON) return "PAID";
  if (input.now.getTime() > input.dueDate.getTime()) return "OVERDUE";
  if (input.paidAmount > EPSILON) return "PARTLY_PAID";
  return "UNPAID";
};
