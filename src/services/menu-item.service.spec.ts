import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MenuCategory } from "@/generated/prisma/client";

vi.mock("@/repositories/menu-category.repository", () => ({
  findCategoriesByRestaurant: vi.fn(),
  findMenuCategoryById: vi.fn(),
}));
vi.mock("@/repositories/menu-item.repository", () => ({
  createMenuItem: vi.fn(),
  findMenuItemOwnership: vi.fn(),
  findMenuItemsByRestaurant: vi.fn(),
  softDeleteMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
}));
vi.mock("@/repositories/modifier-group.repository", () => ({
  findModifierGroupOwnership: vi.fn(),
}));
vi.mock("@/repositories/restaurant.repository", () => ({
  findRestaurantById: vi.fn(),
}));

import { findMenuCategoryById } from "@/repositories/menu-category.repository";
import { createMenuItem } from "@/repositories/menu-item.repository";
import {
  createItem,
  isItemAvailable,
  MENU_CATEGORY_NOT_FOUND,
  MENU_FORBIDDEN,
  resolveItemTax,
} from "./menu-item.service";

const REGULAR = {
  gstRegistrationType: "REGULAR" as const,
  serviceGstRate: 5,
  pricesTaxInclusive: false,
  sacCode: "996331",
  taxSystem: "IN_GST" as const,
  vatTerritory: "METROPOLE" as const,
};

const servedItem = {
  itemType: "SERVED" as const,
  goodsGstRate: null,
  hsnSacCode: null,
  priceTaxInclusive: null,
};

describe("resolveItemTax", () => {
  it("charges no GST when the restaurant is unregistered", () => {
    const tax = resolveItemTax(servedItem, {
      ...REGULAR,
      gstRegistrationType: "UNREGISTERED",
    });
    expect(tax).toMatchObject({ kind: "NONE", rate: 0, separatelyCharged: false });
  });

  it("applies the outlet service rate to served food", () => {
    const tax = resolveItemTax(servedItem, REGULAR);
    expect(tax).toMatchObject({
      kind: "SERVICE",
      rate: 5,
      code: "996331",
      separatelyCharged: true,
      inclusive: false,
    });
  });

  it("applies a packaged item's own goods rate + HSN", () => {
    const tax = resolveItemTax(
      {
        itemType: "PACKAGED_GOODS",
        goodsGstRate: 18,
        hsnSacCode: "2202",
        priceTaxInclusive: null,
      },
      REGULAR,
    );
    expect(tax).toMatchObject({ kind: "GOODS", rate: 18, code: "2202" });
  });

  it("falls back to the service rate for packaged goods with no rate set", () => {
    const tax = resolveItemTax(
      { ...servedItem, itemType: "PACKAGED_GOODS" },
      REGULAR,
    );
    expect(tax.kind).toBe("SERVICE");
  });

  it("composition scheme is not separately charged and is inclusive", () => {
    const tax = resolveItemTax(servedItem, {
      ...REGULAR,
      gstRegistrationType: "COMPOSITION",
    });
    expect(tax).toMatchObject({ separatelyCharged: false, inclusive: true });
  });

  it("lets an item override tax-inclusive pricing", () => {
    const tax = resolveItemTax(
      { ...servedItem, priceTaxInclusive: true },
      REGULAR,
    );
    expect(tax.inclusive).toBe(true);
  });
});

describe("isItemAvailable", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");
  const category = { isActive: true, deletedAt: null };
  const base = { isActive: true, deletedAt: null, category, disables: [] };

  it("is available when active with no 86", () => {
    expect(isItemAvailable(base, now)).toBe(true);
  });

  it("is unavailable when the item is inactive", () => {
    expect(isItemAvailable({ ...base, isActive: false }, now)).toBe(false);
  });

  it("is unavailable when the category is off", () => {
    expect(
      isItemAvailable(
        { ...base, category: { isActive: false, deletedAt: null } },
        now,
      ),
    ).toBe(false);
  });

  it("is unavailable during a live 86 (future resume)", () => {
    const item = {
      ...base,
      disables: [
        { reenabledAt: null, resumeAt: new Date("2026-07-18T18:00:00.000Z") },
      ],
    };
    expect(isItemAvailable(item, now)).toBe(false);
  });

  it("becomes available once the 86 resume time has passed", () => {
    const item = {
      ...base,
      disables: [
        { reenabledAt: null, resumeAt: new Date("2026-07-18T06:00:00.000Z") },
      ],
    };
    expect(isItemAvailable(item, now)).toBe(true);
  });

  it("is unavailable for a manual 86 (no resume time)", () => {
    const item = { ...base, disables: [{ reenabledAt: null, resumeAt: null }] };
    expect(isItemAvailable(item, now)).toBe(false);
  });
});

const makeCategory = (overrides: Partial<MenuCategory> = {}): MenuCategory => ({
  id: "cat_1",
  vatCategory: "FOOD",
  restaurantId: "res_1",
  name: "Starters",
  description: null,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe("createItem", () => {
  const input = {
    categoryId: "cat_1",
    name: "Paneer Tikka",
    itemType: "SERVED" as const,
    price: 250,
    sortOrder: 0,
    isActive: true,
    variants: [],
    modifierGroupIds: [],
  };

  beforeEach(() => vi.clearAllMocks());

  it("creates the item when the category is owned", async () => {
    vi.mocked(findMenuCategoryById).mockResolvedValue(makeCategory());

    await createItem("res_1", input);

    expect(createMenuItem).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({ categoryId: "cat_1", name: "Paneer Tikka" }),
    );
  });

  it("rejects a category owned by another restaurant", async () => {
    vi.mocked(findMenuCategoryById).mockResolvedValue(
      makeCategory({ restaurantId: "other" }),
    );

    await expect(createItem("res_1", input)).rejects.toThrow(MENU_FORBIDDEN);
    expect(createMenuItem).not.toHaveBeenCalled();
  });

  it("rejects a missing category", async () => {
    vi.mocked(findMenuCategoryById).mockResolvedValue(null);

    await expect(createItem("res_1", input)).rejects.toThrow(
      MENU_CATEGORY_NOT_FOUND,
    );
  });
});

describe("resolveItemTax — French VAT", () => {
  const profile = {
    gstRegistrationType: "UNREGISTERED" as const,
    serviceGstRate: null,
    pricesTaxInclusive: false,
    sacCode: null,
    taxSystem: "FR_VAT" as const,
    vatTerritory: "METROPOLE" as const,
  };
  const item = {
    itemType: "SERVED" as const,
    goodsGstRate: null,
    hsnSacCode: null,
    priceTaxInclusive: null,
  };

  it("always prices French menus tax-inclusive, even if the profile says otherwise", () => {
    const tax = resolveItemTax({ ...item, sectionVatCategory: "FOOD" }, profile);
    expect(tax.kind).toBe("VAT");
    expect(tax.inclusive).toBe(true);
    expect(tax.rate).toBe(10);
  });

  it("gives an item the rate of its menu section", () => {
    const tax = resolveItemTax(
      { ...item, sectionVatCategory: "SOFT_DRINK" },
      profile,
    );
    expect(tax.ratesByService).toEqual({ DINE_IN: 10, TAKEAWAY: 5.5, DELIVERY: 5.5 });
  });

  it("lets a wine inside « Boissons » override its section to 20 %", () => {
    const tax = resolveItemTax(
      { ...item, vatCategory: "ALCOHOL", sectionVatCategory: "SOFT_DRINK" },
      profile,
    );
    expect(tax.vatCategory).toBe("ALCOHOL");
    expect(tax.ratesByService?.TAKEAWAY).toBe(20);
  });

  it("ignores GST registration entirely under French VAT", () => {
    const tax = resolveItemTax({ ...item, sectionVatCategory: "FOOD" }, profile);
    expect(tax.separatelyCharged).toBe(true);
  });
});

/**
 * The seam that broke once: getMenu builds its own tax profile from the
 * restaurant row, and it used to drop the tax system — so French restaurants
 * silently sold at 0 % while every unit test of resolveItemTax still passed.
 * This test goes through getMenu itself.
 */
describe("getMenu — tax profile reaches the menu", () => {
  const menuItemRow = (o: Record<string, unknown> = {}) => ({
    id: "m1",
    restaurantId: "res_1",
    categoryId: "cat_1",
    name: "Limonade",
    shortDescription: null,
    longDescription: null,
    itemType: "SERVED",
    dietaryType: null,
    price: 3.5,
    priceTaxInclusive: null,
    goodsGstRate: null,
    hsnSacCode: null,
    vatCategory: null,
    sortOrder: 0,
    isActive: true,
    deletedAt: null,
    category: { id: "cat_1", isActive: true, deletedAt: null, vatCategory: "SOFT_DRINK" },
    disables: [],
    images: [],
    variants: [],
    modifierGroups: [],
    ...o,
  });

  it("applies French VAT to every item of a French restaurant", async () => {
    const { findRestaurantById } = await import("@/repositories/restaurant.repository");
    const { findCategoriesByRestaurant } = await import("@/repositories/menu-category.repository");
    const { findMenuItemsByRestaurant } = await import("@/repositories/menu-item.repository");
    vi.mocked(findRestaurantById).mockResolvedValue({
      id: "res_1",
      deletedAt: null,
      gstRegistrationType: "UNREGISTERED",
      serviceGstRate: null,
      pricesTaxInclusive: false,
      sacCode: null,
      taxSystem: "FR_VAT",
      vatTerritory: "METROPOLE",
    } as never);
    vi.mocked(findCategoriesByRestaurant).mockResolvedValue([]);
    vi.mocked(findMenuItemsByRestaurant).mockResolvedValue([menuItemRow()] as never);

    const { getMenu } = await import("./menu-item.service");
    const menu = await getMenu("res_1");

    expect(menu.items[0].tax.kind).toBe("VAT");
    expect(menu.items[0].tax.ratesByService?.TAKEAWAY).toBe(5.5);
  });

  it("uses the restaurant's territory, not continental France, when set", async () => {
    const { findRestaurantById } = await import("@/repositories/restaurant.repository");
    const { findMenuItemsByRestaurant } = await import("@/repositories/menu-item.repository");
    vi.mocked(findRestaurantById).mockResolvedValue({
      id: "res_1",
      deletedAt: null,
      gstRegistrationType: "UNREGISTERED",
      serviceGstRate: null,
      pricesTaxInclusive: false,
      sacCode: null,
      taxSystem: "FR_VAT",
      vatTerritory: "REUNION",
    } as never);
    vi.mocked(findMenuItemsByRestaurant).mockResolvedValue([menuItemRow()] as never);

    const { getMenu } = await import("./menu-item.service");
    const menu = await getMenu("res_1");

    expect(menu.items[0].tax.rate).toBe(2.1);
  });
});
