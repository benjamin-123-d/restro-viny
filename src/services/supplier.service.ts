import type { SupplierHoldType } from "@/generated/prisma/client";
import type {
  CreateSupplierGroupInput,
  CreateSupplierInput,
  SetItemDefaultSupplierInput,
  SetSupplierHoldInput,
  UpdateSupplierGroupInput,
  UpdateSupplierInput,
} from "@/lib/validators/purchasing";
import {
  countSuppliersInGroup,
  createSupplier as createSupplierRepo,
  createSupplierGroup as createSupplierGroupRepo,
  findSupplierById,
  findSupplierByName,
  findSupplierGroupById,
  findSupplierGroupByName,
  findSupplierGroups,
  findSupplierMoneyRows,
  findSuppliersByRestaurant,
  maxSupplierCode,
  reviveSupplier,
  reviveSupplierGroup,
  setStockItemDefaultSupplier,
  setSupplierHold as setSupplierHoldRepo,
  softDeleteSupplier,
  softDeleteSupplierGroup,
  updateSupplier as updateSupplierRepo,
  updateSupplierGroup as updateSupplierGroupRepo,
  type SupplierGroupWriteData,
  type SupplierWithGroup,
  type SupplierWriteData,
} from "@/repositories/supplier.repository";
import type {
  SupplierDTO,
  SupplierGroupDTO,
  SupplierSummaryDTO,
} from "@/types/purchasing";

export const SUPPLIER_NOT_FOUND = "SUPPLIER_NOT_FOUND";
export const SUPPLIER_NAME_TAKEN = "SUPPLIER_NAME_TAKEN";
export const SUPPLIER_BLOCKED = "SUPPLIER_BLOCKED";
export const SUPPLIER_GROUP_NOT_FOUND = "SUPPLIER_GROUP_NOT_FOUND";
export const SUPPLIER_GROUP_NAME_TAKEN = "SUPPLIER_GROUP_NAME_TAKEN";
export const SUPPLIER_GROUP_IN_USE = "SUPPLIER_GROUP_IN_USE";

export interface PurchasingContext {
  readonly restaurantId: string;
  readonly userId: string;
}

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

/** A hold counts only until its release date, if one was scheduled. */
const holdIsLive = (supplier: SupplierWithGroup, now: Date): boolean =>
  supplier.onHold &&
  (supplier.releaseDate === null || supplier.releaseDate.getTime() > now.getTime());

export const mapSupplier = (
  s: SupplierWithGroup,
  now: Date = new Date(),
): SupplierDTO => ({
  id: s.id,
  code: s.code,
  name: s.name,
  supplierGroupId: s.supplierGroupId,
  supplierGroupName: s.supplierGroup?.name ?? null,
  taxId: s.taxId,
  contactPerson: s.contactPerson,
  email: s.email,
  phone: s.phone,
  website: s.website,
  addressLine1: s.addressLine1,
  addressLine2: s.addressLine2,
  city: s.city,
  state: s.state,
  postalCode: s.postalCode,
  country: s.country,
  currency: s.currency,
  paymentTermsDays: s.paymentTermsDays,
  onHold: s.onHold,
  holdType: s.holdType,
  releaseDate: iso(s.releaseDate),
  preventRfq: s.preventRfq,
  preventPo: s.preventPo,
  disabled: s.disabled,
  notes: s.notes,
  isBlocked: holdIsLive(s, now),
});

/** What a caller is trying to do with a supplier, for hold enforcement. */
export type SupplierActivity = "RFQ" | "ORDERS" | "INVOICES" | "PAYMENTS";

const HOLD_BLOCKS: Readonly<Record<SupplierHoldType, readonly SupplierActivity[]>> =
  {
    ALL: ["RFQ", "ORDERS", "INVOICES", "PAYMENTS"],
    INVOICES: ["INVOICES"],
    PAYMENTS: ["PAYMENTS"],
  };

/**
 * Gate every purchasing document on the supplier's own settings. ERPNext splits
 * this between `on_hold`/`hold_type` and the `prevent_rfqs`/`prevent_pos`
 * flags; both are enforced here so no document layer has to remember to.
 */
export const assertSupplierAccepts = (
  supplier: SupplierWithGroup,
  activity: SupplierActivity,
  now: Date = new Date(),
): void => {
  if (activity === "RFQ" && supplier.preventRfq) {
    throw new Error(SUPPLIER_BLOCKED);
  }
  if (activity === "ORDERS" && supplier.preventPo) {
    throw new Error(SUPPLIER_BLOCKED);
  }
  if (
    holdIsLive(supplier, now) &&
    supplier.holdType !== null &&
    HOLD_BLOCKS[supplier.holdType].includes(activity)
  ) {
    throw new Error(SUPPLIER_BLOCKED);
  }
};

/** Load a supplier, proving it belongs to this restaurant. */
export const loadOwnedSupplier = async (
  restaurantId: string,
  id: string,
): Promise<SupplierWithGroup> => {
  const supplier = await findSupplierById(id);
  if (!supplier || supplier.deletedAt || supplier.restaurantId !== restaurantId) {
    throw new Error(SUPPLIER_NOT_FOUND);
  }
  return supplier;
};

const toSupplierWriteData = (
  input: CreateSupplierInput | UpdateSupplierInput,
): SupplierWriteData => ({
  name: input.name,
  supplierGroupId: input.supplierGroupId ?? null,
  taxId: input.taxId ?? null,
  contactPerson: input.contactPerson ?? null,
  email: input.email ?? null,
  phone: input.phone ?? null,
  website: input.website ?? null,
  addressLine1: input.addressLine1 ?? null,
  addressLine2: input.addressLine2 ?? null,
  city: input.city ?? null,
  state: input.state ?? null,
  postalCode: input.postalCode ?? null,
  country: input.country ?? null,
  currency: input.currency ?? null,
  paymentTermsDays: input.paymentTermsDays ?? null,
  preventRfq: input.preventRfq,
  preventPo: input.preventPo,
  disabled: input.disabled,
  notes: input.notes ?? null,
});

const nextSupplierCode = async (restaurantId: string): Promise<string> =>
  `SUP-${String((await maxSupplierCode(restaurantId)) + 1).padStart(5, "0")}`;

export const createSupplier = async (
  ctx: PurchasingContext,
  input: CreateSupplierInput,
): Promise<SupplierDTO> => {
  const existing = await findSupplierByName(ctx.restaurantId, input.name);
  if (existing && !existing.deletedAt) {
    throw new Error(SUPPLIER_NAME_TAKEN);
  }
  const data = toSupplierWriteData(input);
  if (existing) {
    return mapSupplier(await reviveSupplier(existing.id, data));
  }
  const code = await nextSupplierCode(ctx.restaurantId);
  return mapSupplier(await createSupplierRepo(ctx.restaurantId, code, data));
};

export const updateSupplier = async (
  ctx: PurchasingContext,
  input: UpdateSupplierInput,
): Promise<SupplierDTO> => {
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.id);
  if (input.name !== supplier.name) {
    const clash = await findSupplierByName(ctx.restaurantId, input.name);
    if (clash && clash.id !== supplier.id && !clash.deletedAt) {
      throw new Error(SUPPLIER_NAME_TAKEN);
    }
  }
  return mapSupplier(
    await updateSupplierRepo(supplier.id, toSupplierWriteData(input)),
  );
};

/** Soft delete — purchase history must keep naming who it was bought from. */
export const deleteSupplier = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.id);
  await softDeleteSupplier(supplier.id);
};

export const setSupplierHold = async (
  ctx: PurchasingContext,
  input: SetSupplierHoldInput,
): Promise<SupplierDTO> => {
  const supplier = await loadOwnedSupplier(ctx.restaurantId, input.id);
  return mapSupplier(
    await setSupplierHoldRepo(supplier.id, {
      onHold: input.onHold,
      holdType: input.onHold ? (input.holdType ?? null) : null,
      releaseDate: input.onHold ? (input.releaseDate ?? null) : null,
    }),
  );
};

export const getSupplier = async (
  ctx: PurchasingContext,
  id: string,
): Promise<SupplierDTO> =>
  mapSupplier(await loadOwnedSupplier(ctx.restaurantId, id));

export const listSuppliers = async (
  ctx: PurchasingContext,
  opts: { includeDisabled?: boolean; search?: string },
): Promise<SupplierSummaryDTO[]> => {
  const now = new Date();
  const [suppliers, money] = await Promise.all([
    findSuppliersByRestaurant(ctx.restaurantId, opts),
    findSupplierMoneyRows(ctx.restaurantId, now),
  ]);
  const byId = new Map(money.map((row) => [row.supplierId, row]));
  return suppliers.map((s) => {
    const m = byId.get(s.id);
    return {
      ...mapSupplier(s, now),
      openOrderCount: m?.openOrderCount ?? 0,
      outstandingAmount: m?.outstandingAmount ?? 0,
      overdueAmount: m?.overdueAmount ?? 0,
      totalPurchased: m?.totalPurchased ?? 0,
      lastOrderDate: iso(m?.lastOrderDate ?? null),
    };
  });
};

export const setItemDefaultSupplier = async (
  ctx: PurchasingContext,
  input: SetItemDefaultSupplierInput,
): Promise<void> => {
  if (input.supplierId !== null) {
    await loadOwnedSupplier(ctx.restaurantId, input.supplierId);
  }
  await setStockItemDefaultSupplier(input.stockItemId, input.supplierId);
};

// -------------------------------------------------------- supplier group ---

const toGroupWriteData = (
  input: CreateSupplierGroupInput | UpdateSupplierGroupInput,
): SupplierGroupWriteData => ({
  name: input.name,
  defaultPaymentTermsDays: input.defaultPaymentTermsDays ?? null,
  notes: input.notes ?? null,
});

export const listSupplierGroups = async (
  ctx: PurchasingContext,
): Promise<SupplierGroupDTO[]> =>
  (await findSupplierGroups(ctx.restaurantId)).map((g) => ({
    id: g.id,
    name: g.name,
    defaultPaymentTermsDays: g.defaultPaymentTermsDays,
    notes: g.notes,
    supplierCount: g._count.suppliers,
  }));

export const createSupplierGroup = async (
  ctx: PurchasingContext,
  input: CreateSupplierGroupInput,
): Promise<SupplierGroupDTO> => {
  const existing = await findSupplierGroupByName(ctx.restaurantId, input.name);
  if (existing && !existing.deletedAt) {
    throw new Error(SUPPLIER_GROUP_NAME_TAKEN);
  }
  const data = toGroupWriteData(input);
  const group = existing
    ? await reviveSupplierGroup(existing.id, data)
    : await createSupplierGroupRepo(ctx.restaurantId, data);
  return {
    id: group.id,
    name: group.name,
    defaultPaymentTermsDays: group.defaultPaymentTermsDays,
    notes: group.notes,
    supplierCount: 0,
  };
};

const loadOwnedGroup = async (restaurantId: string, id: string) => {
  const group = await findSupplierGroupById(id);
  if (!group || group.deletedAt || group.restaurantId !== restaurantId) {
    throw new Error(SUPPLIER_GROUP_NOT_FOUND);
  }
  return group;
};

export const updateSupplierGroup = async (
  ctx: PurchasingContext,
  input: UpdateSupplierGroupInput,
): Promise<SupplierGroupDTO> => {
  const group = await loadOwnedGroup(ctx.restaurantId, input.id);
  if (input.name !== group.name) {
    const clash = await findSupplierGroupByName(ctx.restaurantId, input.name);
    if (clash && clash.id !== group.id && !clash.deletedAt) {
      throw new Error(SUPPLIER_GROUP_NAME_TAKEN);
    }
  }
  const updated = await updateSupplierGroupRepo(
    group.id,
    toGroupWriteData(input),
  );
  return {
    id: updated.id,
    name: updated.name,
    defaultPaymentTermsDays: updated.defaultPaymentTermsDays,
    notes: updated.notes,
    supplierCount: await countSuppliersInGroup(updated.id),
  };
};

/** Groups are only removable once empty — reassign the suppliers first. */
export const deleteSupplierGroup = async (
  ctx: PurchasingContext,
  input: { id: string },
): Promise<void> => {
  if ((await countSuppliersInGroup(input.id)) > 0) {
    throw new Error(SUPPLIER_GROUP_IN_USE);
  }
  const group = await loadOwnedGroup(ctx.restaurantId, input.id);
  await softDeleteSupplierGroup(group.id);
};
