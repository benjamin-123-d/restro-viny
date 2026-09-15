import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/order.repository", () => ({
  findOrderById: vi.fn(),
  incrementReceiptReprints: vi.fn(),
}));
vi.mock("@/repositories/restaurant.repository", () => ({
  findRestaurantById: vi.fn(),
}));

import type { Restaurant } from "@/generated/prisma/client";
import {
  findOrderById,
  incrementReceiptReprints,
  type OrderWithRelations,
} from "@/repositories/order.repository";
import { findRestaurantById } from "@/repositories/restaurant.repository";

import {
  buildReceipt,
  getReceipt,
  ORDER_NOT_SETTLED,
  recordReceiptReprint,
} from "./receipt.service";

const item = (o: Record<string, unknown> = {}) => ({
  id: `i${Math.random()}`,
  name: "Poulet DG",
  variantName: null,
  unitPrice: 11,
  quantity: 1,
  taxRate: 10,
  taxInclusive: true,
  isComp: false,
  state: "SERVED",
  vatCategory: "FOOD",
  menuItemId: "m1",
  modifiers: [] as { name: string; priceDelta: number }[],
  ...o,
});

const order = (o: Record<string, unknown> = {}) =>
  ({
    id: "o1",
    restaurantId: "r1",
    orderNumber: 7,
    invoiceNumber: 12,
    orderType: "DINE_IN",
    status: "COMPLETED",
    tableLabel: "T4",
    customerName: null,
    customerAddress: null,
    settledAt: new Date("2026-09-14T12:30:00Z"),
    updatedAt: new Date("2026-09-14T12:30:00Z"),
    discountType: "NONE",
    discountValue: 0,
    discountReason: null,
    grandTotal: 17,
    receiptReprints: 0,
    deletedAt: null,
    items: [item(), item({ name: "Bière pression", unitPrice: 6, taxRate: 20, vatCategory: "ALCOHOL", menuItemId: "m2" })],
    payments: [{ mode: "CARD", amount: 17, tendered: null }],
    ...o,
  }) as unknown as OrderWithRelations;

const restaurant = (o: Partial<Restaurant> = {}) =>
  ({
    id: "r1",
    name: "Le Bistrot du Port",
    legalName: "Bistrot du Port SARL",
    legalForm: "SARL",
    shareCapital: "10 000 €",
    addressLine1: "4 quai Saint-Antoine",
    addressLine2: null,
    postalCode: "69002",
    city: "Lyon",
    phone: "04 78 00 00 00",
    email: null,
    siret: "73282932000074",
    vatNumber: "FR44732829320",
    nafCode: "56.10A",
    rcs: "RCS Lyon 732 829 320",
    drinksLicense: "Licence restaurant",
    vatTerritory: "METROPOLE",
    invoiceFooterNote: "Merci de votre visite !",
    deletedAt: null,
    ...o,
  }) as unknown as Restaurant;

describe("buildReceipt", () => {
  it("prints TTC prices and keys each line to its VAT rate by letter", () => {
    const r = buildReceipt(order(), restaurant(), { duplicate: false });
    expect(r.lines.map((l) => [l.name, l.unitTTC, l.totalTTC, l.vatCode])).toEqual([
      ["Poulet DG", 11, 11, "A"],
      ["Bière pression", 6, 6, "B"],
    ]);
    expect(r.vat.map((v) => [v.code, v.rate])).toEqual([
      ["A", 10],
      ["B", 20],
    ]);
  });

  it("backs VAT out of each rate for the breakdown the law asks for", () => {
    const r = buildReceipt(order(), restaurant(), { duplicate: false });
    expect(r.vat[0]).toMatchObject({ baseHT: 10, vat: 1, totalTTC: 11 });
    expect(r.vat[1]).toMatchObject({ baseHT: 5, vat: 1, totalTTC: 6 });
    expect(r.totalHT).toBe(15);
    expect(r.totalVAT).toBe(2);
    expect(r.totalTTC).toBe(17);
  });

  it("adds options to the unit price and lists them under the dish", () => {
    const r = buildReceipt(
      order({ items: [item({ quantity: 2, modifiers: [{ name: "Supplément frites", priceDelta: 2 }] })] }),
      restaurant(),
      { duplicate: false },
    );
    expect(r.lines[0]).toMatchObject({ unitTTC: 13, totalTTC: 26, details: ["Supplément frites"] });
    expect(r.itemCount).toBe(2);
  });

  it("shows an offered dish at zero and leaves voided lines off", () => {
    const r = buildReceipt(
      order({ items: [item(), item({ name: "Café", unitPrice: 2, isComp: true }), item({ name: "Erreur", state: "VOID" })] }),
      restaurant(),
      { duplicate: false },
    );
    expect(r.lines.map((l) => l.name)).toEqual(["Poulet DG", "Café"]);
    expect(r.lines[1]).toMatchObject({ offered: true, totalTTC: 0 });
  });

  it("shows the discount as the gap between the dishes and what was paid", () => {
    const r = buildReceipt(
      order({ discountType: "PERCENT", discountValue: 10, discountReason: "Fidélité", grandTotal: 15.3 }),
      restaurant(),
      { duplicate: false },
    );
    expect(r.subtotalTTC).toBe(17);
    expect(r.totalTTC).toBe(15.3);
    expect(r.discountTTC).toBe(1.7);
    expect(r.discountReason).toBe("Fidélité");
  });

  it("numbers the invoice in its legal sequence", () => {
    expect(buildReceipt(order(), restaurant(), { duplicate: false }).number).toBe("F-00012");
  });

  it("marks and numbers a duplicate", () => {
    const original = buildReceipt(order(), restaurant(), { duplicate: false });
    const copy = buildReceipt(order({ receiptReprints: 2 }), restaurant(), { duplicate: true });
    expect(original.duplicateNumber).toBeNull();
    expect(copy.duplicateNumber).toBe(3);
  });

  it("prints the seller's legal mentions in their usual shape", () => {
    const { seller } = buildReceipt(order(), restaurant(), { duplicate: false });
    expect(seller.legalIdentity).toBe("SARL au capital de 10 000 €");
    expect(seller.siret).toBe("732 829 320 00074");
    expect(seller.addressLines).toEqual(["4 quai Saint-Antoine", "69002 Lyon"]);
  });

  it("says prices include service, and cites the exemption where VAT does not apply", () => {
    expect(buildReceipt(order(), restaurant(), { duplicate: false }).notices).toContain(
      "Prix TTC en euros, service compris.",
    );
    const guyane = buildReceipt(
      order({ items: [item({ taxRate: 0 })], grandTotal: 11 }),
      restaurant({ vatTerritory: "GUYANE" }),
      { duplicate: false },
    );
    expect(guyane.notices).toContain("TVA non applicable, article 294 du CGI.");
  });

  it("gives back the change on cash", () => {
    const r = buildReceipt(
      order({ payments: [{ mode: "CASH", amount: 17, tendered: 20 }] }),
      restaurant(),
      { duplicate: false },
    );
    expect(r.payments).toEqual([{ label: "Espèces", amount: 17 }]);
    expect(r.changeGiven).toBe(3);
  });
});

describe("getReceipt / recordReceiptReprint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses an order that has not been paid", async () => {
    vi.mocked(findOrderById).mockResolvedValue(order({ status: "OPEN" }));
    vi.mocked(findRestaurantById).mockResolvedValue(restaurant());
    await expect(getReceipt("r1", "o1", false)).rejects.toThrow(ORDER_NOT_SETTLED);
  });

  it("will not show another restaurant's receipt", async () => {
    vi.mocked(findOrderById).mockResolvedValue(order({ restaurantId: "other" }));
    vi.mocked(findRestaurantById).mockResolvedValue(restaurant());
    await expect(getReceipt("r1", "o1", false)).rejects.toThrow();
  });

  it("counts a printed duplicate", async () => {
    vi.mocked(findOrderById).mockResolvedValue(order());
    vi.mocked(incrementReceiptReprints).mockResolvedValue(1);
    await expect(recordReceiptReprint("r1", "o1")).resolves.toBe(1);
    expect(incrementReceiptReprints).toHaveBeenCalledWith("o1");
  });
});
