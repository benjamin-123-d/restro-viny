import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupplierWithGroup } from "@/repositories/supplier.repository";

vi.mock("@/repositories/supplier.repository", () => ({
  countSuppliersInGroup: vi.fn(),
  createSupplier: vi.fn(),
  createSupplierGroup: vi.fn(),
  findSupplierById: vi.fn(),
  findSupplierByName: vi.fn(),
  findSupplierGroupById: vi.fn(),
  findSupplierGroupByName: vi.fn(),
  findSupplierGroups: vi.fn(),
  findSupplierMoneyRows: vi.fn(),
  findSuppliersByRestaurant: vi.fn(),
  maxSupplierCode: vi.fn(),
  reviveSupplier: vi.fn(),
  reviveSupplierGroup: vi.fn(),
  setStockItemDefaultSupplier: vi.fn(),
  setSupplierHold: vi.fn(),
  softDeleteSupplier: vi.fn(),
  softDeleteSupplierGroup: vi.fn(),
  updateSupplier: vi.fn(),
  updateSupplierGroup: vi.fn(),
}));

import {
  countSuppliersInGroup,
  createSupplier as createSupplierRepo,
  createSupplierGroup as createSupplierGroupRepo,
  findSupplierById,
  findSupplierByName,
  findSupplierGroupByName,
  findSupplierMoneyRows,
  findSuppliersByRestaurant,
  maxSupplierCode,
  reviveSupplier,
  setSupplierHold as setSupplierHoldRepo,
  softDeleteSupplier,
} from "@/repositories/supplier.repository";
import {
  assertSupplierAccepts,
  createSupplier,
  createSupplierGroup,
  deleteSupplier,
  deleteSupplierGroup,
  listSuppliers,
  mapSupplier,
  setSupplierHold,
  SUPPLIER_BLOCKED,
  SUPPLIER_GROUP_IN_USE,
  SUPPLIER_GROUP_NAME_TAKEN,
  SUPPLIER_NAME_TAKEN,
  SUPPLIER_NOT_FOUND,
} from "./supplier.service";

const ctx = { restaurantId: "res_1", userId: "u1" };

const makeSupplier = (o: Record<string, unknown> = {}): SupplierWithGroup =>
  ({
    id: "sup_1",
    restaurantId: "res_1",
    code: "SUP-00001",
    name: "Metro Cash & Carry",
    supplierGroupId: null,
    supplierGroup: null,
    taxId: null,
    contactPerson: null,
    email: null,
    phone: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    currency: null,
    paymentTermsDays: null,
    onHold: false,
    holdType: null,
    releaseDate: null,
    preventRfq: false,
    preventPo: false,
    disabled: false,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...o,
  }) as unknown as SupplierWithGroup;

const baseInput = {
  name: "Metro Cash & Carry",
  preventRfq: false,
  preventPo: false,
  disabled: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mapSupplier", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("is not blocked when no hold is set", () => {
    expect(mapSupplier(makeSupplier(), now).isBlocked).toBe(false);
  });

  it("is blocked by an open-ended hold", () => {
    expect(
      mapSupplier(makeSupplier({ onHold: true, holdType: "ALL" }), now)
        .isBlocked,
    ).toBe(true);
  });

  it("is blocked while the release date is still ahead", () => {
    const s = makeSupplier({
      onHold: true,
      holdType: "ALL",
      releaseDate: new Date("2026-07-01T00:00:00Z"),
    });
    expect(mapSupplier(s, now).isBlocked).toBe(true);
  });

  it("is released once the release date has passed", () => {
    const s = makeSupplier({
      onHold: true,
      holdType: "ALL",
      releaseDate: new Date("2026-06-01T00:00:00Z"),
    });
    expect(mapSupplier(s, now).isBlocked).toBe(false);
  });

  it("surfaces the group name for display", () => {
    const s = makeSupplier({
      supplierGroupId: "grp_1",
      supplierGroup: { id: "grp_1", name: "Produce" },
    });
    expect(mapSupplier(s, now).supplierGroupName).toBe("Produce");
  });
});

describe("createSupplier", () => {
  it("issues the next sequential code", async () => {
    vi.mocked(findSupplierByName).mockResolvedValue(null);
    vi.mocked(maxSupplierCode).mockResolvedValue(7);
    vi.mocked(createSupplierRepo).mockResolvedValue(makeSupplier());

    await createSupplier(ctx, baseInput);

    expect(createSupplierRepo).toHaveBeenCalledWith(
      "res_1",
      "SUP-00008",
      expect.objectContaining({ name: "Metro Cash & Carry" }),
    );
  });

  it("starts at SUP-00001 for the first supplier", async () => {
    vi.mocked(findSupplierByName).mockResolvedValue(null);
    vi.mocked(maxSupplierCode).mockResolvedValue(0);
    vi.mocked(createSupplierRepo).mockResolvedValue(makeSupplier());

    await createSupplier(ctx, baseInput);

    expect(createSupplierRepo).toHaveBeenCalledWith(
      "res_1",
      "SUP-00001",
      expect.anything(),
    );
  });

  it("rejects a duplicate name", async () => {
    vi.mocked(findSupplierByName).mockResolvedValue(makeSupplier());
    await expect(createSupplier(ctx, baseInput)).rejects.toThrow(
      SUPPLIER_NAME_TAKEN,
    );
  });

  it("revives a soft-deleted supplier of the same name instead of duplicating", async () => {
    vi.mocked(findSupplierByName).mockResolvedValue(
      makeSupplier({ id: "sup_old", deletedAt: new Date() }),
    );
    vi.mocked(reviveSupplier).mockResolvedValue(makeSupplier());

    await createSupplier(ctx, baseInput);

    expect(reviveSupplier).toHaveBeenCalledWith("sup_old", expect.anything());
    expect(createSupplierRepo).not.toHaveBeenCalled();
  });
});

describe("deleteSupplier", () => {
  it("refuses a supplier from another restaurant", async () => {
    vi.mocked(findSupplierById).mockResolvedValue(
      makeSupplier({ restaurantId: "other" }),
    );
    await expect(deleteSupplier(ctx, { id: "sup_1" })).rejects.toThrow(
      SUPPLIER_NOT_FOUND,
    );
    expect(softDeleteSupplier).not.toHaveBeenCalled();
  });

  it("soft-deletes so purchase history keeps its supplier", async () => {
    vi.mocked(findSupplierById).mockResolvedValue(makeSupplier());
    vi.mocked(softDeleteSupplier).mockResolvedValue(makeSupplier());

    await deleteSupplier(ctx, { id: "sup_1" });

    expect(softDeleteSupplier).toHaveBeenCalledWith("sup_1");
  });
});

describe("setSupplierHold", () => {
  it("clears the hold details when lifting a hold", async () => {
    vi.mocked(findSupplierById).mockResolvedValue(makeSupplier());
    vi.mocked(setSupplierHoldRepo).mockResolvedValue(makeSupplier());

    await setSupplierHold(ctx, { id: "sup_1", onHold: false });

    expect(setSupplierHoldRepo).toHaveBeenCalledWith("sup_1", {
      onHold: false,
      holdType: null,
      releaseDate: null,
    });
  });

  it("stores what the hold blocks and until when", async () => {
    const releaseDate = new Date("2026-08-01T00:00:00Z");
    vi.mocked(findSupplierById).mockResolvedValue(makeSupplier());
    vi.mocked(setSupplierHoldRepo).mockResolvedValue(makeSupplier());

    await setSupplierHold(ctx, {
      id: "sup_1",
      onHold: true,
      holdType: "PAYMENTS",
      releaseDate,
    });

    expect(setSupplierHoldRepo).toHaveBeenCalledWith("sup_1", {
      onHold: true,
      holdType: "PAYMENTS",
      releaseDate,
    });
  });
});

describe("assertSupplierAccepts", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("lets everything through for a supplier with no hold", () => {
    expect(() =>
      assertSupplierAccepts(makeSupplier(), "ORDERS", now),
    ).not.toThrow();
  });

  it("blocks every activity under an ALL hold", () => {
    const s = makeSupplier({ onHold: true, holdType: "ALL" });
    expect(() => assertSupplierAccepts(s, "ORDERS", now)).toThrow(
      SUPPLIER_BLOCKED,
    );
    expect(() => assertSupplierAccepts(s, "INVOICES", now)).toThrow(
      SUPPLIER_BLOCKED,
    );
    expect(() => assertSupplierAccepts(s, "PAYMENTS", now)).toThrow(
      SUPPLIER_BLOCKED,
    );
  });

  it("blocks only the named activity under a targeted hold", () => {
    const s = makeSupplier({ onHold: true, holdType: "PAYMENTS" });
    expect(() => assertSupplierAccepts(s, "PAYMENTS", now)).toThrow(
      SUPPLIER_BLOCKED,
    );
    expect(() => assertSupplierAccepts(s, "ORDERS", now)).not.toThrow();
  });

  it("honours the per-supplier order and RFQ opt-outs", () => {
    expect(() =>
      assertSupplierAccepts(makeSupplier({ preventPo: true }), "ORDERS", now),
    ).toThrow(SUPPLIER_BLOCKED);
    expect(() =>
      assertSupplierAccepts(makeSupplier({ preventRfq: true }), "RFQ", now),
    ).toThrow(SUPPLIER_BLOCKED);
  });

  it("lets a released hold through", () => {
    const s = makeSupplier({
      onHold: true,
      holdType: "ALL",
      releaseDate: new Date("2026-01-01T00:00:00Z"),
    });
    expect(() => assertSupplierAccepts(s, "ORDERS", now)).not.toThrow();
  });
});

describe("listSuppliers", () => {
  it("joins each supplier to its money view, defaulting to zeros", async () => {
    vi.mocked(findSuppliersByRestaurant).mockResolvedValue([
      makeSupplier({ id: "sup_1" }),
      makeSupplier({ id: "sup_2", name: "Fresh Farms" }),
    ]);
    vi.mocked(findSupplierMoneyRows).mockResolvedValue([
      {
        supplierId: "sup_1",
        openOrderCount: 2,
        outstandingAmount: 15000,
        overdueAmount: 5000,
        totalPurchased: 90000,
        lastOrderDate: new Date("2026-06-01T00:00:00Z"),
      },
    ]);

    const rows = await listSuppliers(ctx, {});

    expect(rows[0].outstandingAmount).toBe(15000);
    expect(rows[0].openOrderCount).toBe(2);
    expect(rows[1].outstandingAmount).toBe(0);
    expect(rows[1].lastOrderDate).toBeNull();
  });
});

describe("supplier groups", () => {
  it("rejects a duplicate group name", async () => {
    vi.mocked(findSupplierGroupByName).mockResolvedValue({
      id: "grp_1",
      deletedAt: null,
    } as never);

    await expect(
      createSupplierGroup(ctx, { name: "Produce" }),
    ).rejects.toThrow(SUPPLIER_GROUP_NAME_TAKEN);
  });

  it("creates a group when the name is free", async () => {
    vi.mocked(findSupplierGroupByName).mockResolvedValue(null);
    vi.mocked(createSupplierGroupRepo).mockResolvedValue({
      id: "grp_1",
      name: "Produce",
      defaultPaymentTermsDays: 30,
      notes: null,
    } as never);

    const group = await createSupplierGroup(ctx, {
      name: "Produce",
      defaultPaymentTermsDays: 30,
    });

    expect(group.name).toBe("Produce");
  });

  it("refuses to delete a group suppliers still belong to", async () => {
    vi.mocked(countSuppliersInGroup).mockResolvedValue(3);

    await expect(
      deleteSupplierGroup(ctx, { id: "grp_1" }),
    ).rejects.toThrow(SUPPLIER_GROUP_IN_USE);
  });
});
