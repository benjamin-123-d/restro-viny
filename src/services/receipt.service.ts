import type { Restaurant } from "@/generated/prisma/client";
import { formatSiret } from "@/lib/french-legal";
import { SERVICE_TYPE_LABEL, vatBreakdown } from "@/lib/french-vat";
import { paymentModeLabel } from "@/lib/payment-labels";
import {
  findOrderById,
  incrementReceiptReprints,
  type OrderWithRelations,
} from "@/repositories/order.repository";
import { findRestaurantById } from "@/repositories/restaurant.repository";
import { computeBill } from "@/services/billing";
import { orderToBillLines } from "@/services/order.service";
import type { ReceiptDTO, ReceiptLineDTO, ReceiptSellerDTO } from "@/types/receipt";

export const ORDER_NOT_FOUND = "ORDER_NOT_FOUND";
export const ORDER_NOT_SETTLED = "ORDER_NOT_SETTLED";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (value: unknown): number => Number(value ?? 0);

/** Territories where VAT is provisionally not applied (art. 294 CGI). */
const NO_VAT_TERRITORIES: ReadonlySet<string> = new Set(["GUYANE", "MAYOTTE"]);

export const formatInvoiceNumber = (invoiceNumber: number | null, orderNumber: number): string =>
  invoiceNumber != null ? `F-${String(invoiceNumber).padStart(5, "0")}` : `Ticket ${orderNumber}`;

const sellerOf = (r: Restaurant): ReceiptSellerDTO => {
  const identity = r.legalForm
    ? `${r.legalForm}${r.shareCapital ? ` au capital de ${r.shareCapital}` : ""}`
    : r.shareCapital
      ? `Capital social : ${r.shareCapital}`
      : null;
  return {
    name: r.name,
    legalName: r.legalName,
    legalIdentity: identity,
    addressLines: [
      r.addressLine1,
      r.addressLine2,
      [r.postalCode, r.city].filter(Boolean).join(" ") || null,
    ].filter((line): line is string => Boolean(line)),
    phone: r.phone,
    email: r.email,
    siret: r.siret ? formatSiret(r.siret) : null,
    vatNumber: r.vatNumber,
    nafCode: r.nafCode,
    rcs: r.rcs,
    drinksLicense: r.drinksLicense,
  };
};

/**
 * Everything a French restaurant receipt must show, computed from the order
 * exactly as it was settled: TTC prices line by line, the VAT split by rate
 * (HT, TVA, TTC), the seller's legal mentions, and a numbered DUPLICATA mark
 * on every reprint.
 */
export const buildReceipt = (
  order: OrderWithRelations,
  restaurant: Restaurant,
  options: { readonly duplicate: boolean },
): ReceiptDTO => {
  const sold = order.items.filter((i) => i.state !== "VOID");
  const bill = computeBill(orderToBillLines(order), {
    type: order.discountType,
    value: num(order.discountValue),
  });

  const vatRows = vatBreakdown(
    sold.map((item, i) => ({
      taxRate: num(item.taxRate),
      taxable: bill.lines[i]?.taxable ?? 0,
      tax: bill.lines[i]?.tax ?? 0,
    })),
  );
  const codeOf = new Map(vatRows.map((row, i) => [row.rate, String.fromCharCode(65 + i)]));

  const lines: ReceiptLineDTO[] = sold.map((item, i) => {
    const unitTTC = round2(
      num(item.unitPrice) + item.modifiers.reduce((s, m) => s + num(m.priceDelta), 0),
    );
    return {
      name: item.variantName ? `${item.name} (${item.variantName})` : item.name,
      details: item.modifiers.map((m) => m.name),
      quantity: item.quantity,
      unitTTC,
      totalTTC: item.isComp ? 0 : (bill.lines[i]?.gross ?? round2(unitTTC * item.quantity)),
      vatRate: num(item.taxRate),
      vatCode: codeOf.get(num(item.taxRate)) ?? "",
      offered: item.isComp,
    };
  });

  const subtotalTTC = round2(lines.reduce((s, l) => s + l.totalTTC, 0));
  const totalTTC = num(order.grandTotal);
  const discounted = order.discountType !== "NONE";

  const cashChange = order.payments
    .filter((p) => p.mode === "CASH" && p.tendered != null)
    .reduce((s, p) => s + Math.max(0, num(p.tendered) - num(p.amount)), 0);

  const allZero = vatRows.every((row) => row.rate === 0);
  const notices = [
    "Prix TTC en euros, service compris.",
    ...(allZero && NO_VAT_TERRITORIES.has(restaurant.vatTerritory)
      ? ["TVA non applicable, article 294 du CGI."]
      : []),
  ];

  return {
    orderId: order.id,
    number: formatInvoiceNumber(order.invoiceNumber, order.orderNumber),
    orderNumber: order.orderNumber,
    issuedAt: (order.settledAt ?? order.updatedAt).toISOString(),
    service: order.orderType,
    serviceLabel: SERVICE_TYPE_LABEL[order.orderType],
    tableLabel: order.orderType === "DINE_IN" ? order.tableLabel : null,
    customerName: order.customerName,
    customerAddress: order.customerAddress,
    duplicateNumber: options.duplicate ? order.receiptReprints + 1 : null,
    seller: sellerOf(restaurant),
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalTTC,
    discountTTC: discounted ? round2(subtotalTTC - totalTTC) : 0,
    discountReason: discounted ? order.discountReason : null,
    roundingTTC: discounted ? 0 : round2(totalTTC - subtotalTTC),
    totalHT: round2(vatRows.reduce((s, r) => s + r.baseHT, 0)),
    totalVAT: round2(vatRows.reduce((s, r) => s + r.vat, 0)),
    totalTTC,
    vat: vatRows.map((row) => ({ code: codeOf.get(row.rate) ?? "", ...row })),
    payments: order.payments.map((p) => ({ label: paymentModeLabel(p.mode), amount: num(p.amount) })),
    changeGiven: round2(cashChange),
    notices,
    footer: restaurant.invoiceFooterNote?.trim() || null,
  };
};

const loadOwned = async (restaurantId: string, orderId: string): Promise<OrderWithRelations> => {
  const order = await findOrderById(orderId);
  if (!order || order.deletedAt || order.restaurantId !== restaurantId) {
    throw new Error(ORDER_NOT_FOUND);
  }
  return order;
};

export const getReceipt = async (
  restaurantId: string,
  orderId: string,
  duplicate: boolean,
): Promise<ReceiptDTO> => {
  const [order, restaurant] = await Promise.all([
    loadOwned(restaurantId, orderId),
    findRestaurantById(restaurantId),
  ]);
  if (!restaurant) throw new Error(ORDER_NOT_FOUND);
  if (order.status !== "COMPLETED") throw new Error(ORDER_NOT_SETTLED);
  return buildReceipt(order, restaurant, { duplicate });
};

/** Called when a duplicate is actually printed, so each copy gets its number. */
export const recordReceiptReprint = async (
  restaurantId: string,
  orderId: string,
): Promise<number> => {
  const order = await loadOwned(restaurantId, orderId);
  return incrementReceiptReprints(order.id);
};
