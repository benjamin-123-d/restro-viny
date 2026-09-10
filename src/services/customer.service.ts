import type {
  CreateCustomerGroupInput,
  CreateCustomerInput,
  CreateTerritoryInput,
  UpdateCustomerGroupInput,
  UpdateCustomerInput,
  UpdateTerritoryInput,
} from "@/lib/validators/selling";
import {
  countCustomersInGroup,
  countCustomersInTerritory,
  createCustomer as createCustomerRepo,
  createCustomerGroup as createCustomerGroupRepo,
  createTerritory as createTerritoryRepo,
  findCustomerById,
  findCustomerByName,
  findCustomerGroupById,
  findCustomerGroupByName,
  findCustomerGroups,
  findCustomerMoneyRows,
  findCustomers,
  findTerritories,
  findTerritoryById,
  findTerritoryByName,
  maxCustomerCode,
  reviveCustomer,
  softDeleteCustomer,
  softDeleteCustomerGroup,
  softDeleteTerritory,
  updateCustomer as updateCustomerRepo,
  updateCustomerGroup as updateCustomerGroupRepo,
  updateTerritory as updateTerritoryRepo,
  type CustomerWithRefs,
  type CustomerWriteData,
} from "@/repositories/customer.repository";
import type { PurchasingContext } from "@/services/supplier.service";
import type {
  CustomerDTO,
  CustomerGroupDTO,
  CustomerSummaryDTO,
  TerritoryDTO,
} from "@/types/selling";

export const CUSTOMER_NOT_FOUND = "CUSTOMER_NOT_FOUND";
export const CUSTOMER_NAME_TAKEN = "CUSTOMER_NAME_TAKEN";
export const CUSTOMER_DISABLED = "CUSTOMER_DISABLED";
export const CUSTOMER_OVER_CREDIT_LIMIT = "CUSTOMER_OVER_CREDIT_LIMIT";
export const CUSTOMER_GROUP_NOT_FOUND = "CUSTOMER_GROUP_NOT_FOUND";
export const CUSTOMER_GROUP_NAME_TAKEN = "CUSTOMER_GROUP_NAME_TAKEN";
export const CUSTOMER_GROUP_IN_USE = "CUSTOMER_GROUP_IN_USE";
export const TERRITORY_NOT_FOUND = "TERRITORY_NOT_FOUND";
export const TERRITORY_NAME_TAKEN = "TERRITORY_NAME_TAKEN";
export const TERRITORY_IN_USE = "TERRITORY_IN_USE";

/** Selling reuses the same {restaurantId, userId} context shape as purchasing. */
export type SellingContext = PurchasingContext;

const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v != null ? Number(v) : null);
const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

export const mapCustomer = (c: CustomerWithRefs): CustomerDTO => ({
  id: c.id,
  code: c.code,
  name: c.name,
  customerGroupId: c.customerGroupId,
  customerGroupName: c.customerGroup?.name ?? null,
  territoryId: c.territoryId,
  territoryName: c.territory?.name ?? null,
  taxId: c.taxId,
  contactPerson: c.contactPerson,
  email: c.email,
  phone: c.phone,
  addressLine1: c.addressLine1,
  addressLine2: c.addressLine2,
  city: c.city,
  state: c.state,
  postalCode: c.postalCode,
  country: c.country,
  currency: c.currency,
  paymentTermsDays: c.paymentTermsDays,
  creditLimit: numOrNull(c.creditLimit),
  blockOnCreditLimit: c.blockOnCreditLimit,
  loyaltyPoints: c.loyaltyPoints,
  disabled: c.disabled,
  notes: c.notes,
});

export const loadOwnedCustomer = async (
  restaurantId: string,
  id: string,
): Promise<CustomerWithRefs> => {
  const customer = await findCustomerById(id);
  if (!customer || customer.deletedAt || customer.restaurantId !== restaurantId) {
    throw new Error(CUSTOMER_NOT_FOUND);
  }
  return customer;
};

/**
 * Gate a new sales document on the customer's own settings: a disabled account
 * can never be sold to, and one past its credit limit is stopped only when the
 * owner asked for that (`blockOnCreditLimit`).
 */
export const assertCustomerCanOrder = (
  customer: CustomerWithRefs,
  outstandingAmount: number,
  additionalAmount = 0,
): void => {
  if (customer.disabled) {
    throw new Error(CUSTOMER_DISABLED);
  }
  const limit = numOrNull(customer.creditLimit);
  if (
    customer.blockOnCreditLimit &&
    limit !== null &&
    limit > 0 &&
    outstandingAmount + additionalAmount > limit
  ) {
    throw new Error(CUSTOMER_OVER_CREDIT_LIMIT);
  }
};

const toCustomerWriteData = (
  input: CreateCustomerInput | UpdateCustomerInput,
): CustomerWriteData => ({
  name: input.name,
  customerGroupId: input.customerGroupId ?? null,
  territoryId: input.territoryId ?? null,
  taxId: input.taxId ?? null,
  contactPerson: input.contactPerson ?? null,
  email: input.email ?? null,
  phone: input.phone ?? null,
  addressLine1: input.addressLine1 ?? null,
  addressLine2: input.addressLine2 ?? null,
  city: input.city ?? null,
  state: input.state ?? null,
  postalCode: input.postalCode ?? null,
  country: input.country ?? null,
  currency: input.currency ?? null,
  paymentTermsDays: input.paymentTermsDays ?? null,
  creditLimit: input.creditLimit ?? null,
  blockOnCreditLimit: input.blockOnCreditLimit,
  disabled: input.disabled,
  notes: input.notes ?? null,
});

const nextCustomerCode = async (restaurantId: string): Promise<string> =>
  `CUST-${String((await maxCustomerCode(restaurantId)) + 1).padStart(5, "0")}`;

export const createCustomer = async (
  ctx: SellingContext,
  input: CreateCustomerInput,
): Promise<CustomerDTO> => {
  const existing = await findCustomerByName(ctx.restaurantId, input.name);
  if (existing && !existing.deletedAt) {
    throw new Error(CUSTOMER_NAME_TAKEN);
  }
  const data = toCustomerWriteData(input);
  if (existing) {
    return mapCustomer(await reviveCustomer(existing.id, data));
  }
  const code = await nextCustomerCode(ctx.restaurantId);
  return mapCustomer(await createCustomerRepo(ctx.restaurantId, code, data));
};

export const updateCustomer = async (
  ctx: SellingContext,
  input: UpdateCustomerInput,
): Promise<CustomerDTO> => {
  const customer = await loadOwnedCustomer(ctx.restaurantId, input.id);
  if (input.name !== customer.name) {
    const clash = await findCustomerByName(ctx.restaurantId, input.name);
    if (clash && clash.id !== customer.id && !clash.deletedAt) {
      throw new Error(CUSTOMER_NAME_TAKEN);
    }
  }
  return mapCustomer(
    await updateCustomerRepo(customer.id, toCustomerWriteData(input)),
  );
};

/** Soft delete — sales history must keep naming who it was sold to. */
export const deleteCustomer = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  const customer = await loadOwnedCustomer(ctx.restaurantId, input.id);
  await softDeleteCustomer(customer.id);
};

export const getCustomer = async (
  ctx: SellingContext,
  id: string,
): Promise<CustomerDTO> =>
  mapCustomer(await loadOwnedCustomer(ctx.restaurantId, id));

export const listCustomers = async (
  ctx: SellingContext,
  opts: { includeDisabled?: boolean; search?: string } = {},
): Promise<CustomerSummaryDTO[]> => {
  const now = new Date();
  const [customers, money] = await Promise.all([
    findCustomers(ctx.restaurantId, opts),
    findCustomerMoneyRows(ctx.restaurantId, now),
  ]);
  const byId = new Map(money.map((row) => [row.customerId, row]));

  return customers.map((c) => {
    const m = byId.get(c.id);
    const outstandingAmount = m?.outstandingAmount ?? 0;
    const limit = numOrNull(c.creditLimit);
    return {
      ...mapCustomer(c),
      openOrderCount: m?.openOrderCount ?? 0,
      outstandingAmount,
      overdueAmount: m?.overdueAmount ?? 0,
      totalSold: m?.totalSold ?? 0,
      lastOrderDate: iso(m?.lastOrderDate ?? null),
      overCreditLimit:
        limit !== null && limit > 0 && outstandingAmount > limit,
      creditAvailable:
        limit !== null && limit > 0
          ? Math.round((limit - outstandingAmount) * 100) / 100
          : null,
    };
  });
};

/** Outstanding for one customer, used to gate a new order. */
export const outstandingFor = async (
  restaurantId: string,
  customerId: string,
): Promise<number> => {
  const rows = await findCustomerMoneyRows(restaurantId, new Date());
  return rows.find((r) => r.customerId === customerId)?.outstandingAmount ?? 0;
};

// -------------------------------------------------------- customer group ---

export const listCustomerGroups = async (
  ctx: SellingContext,
): Promise<CustomerGroupDTO[]> =>
  (await findCustomerGroups(ctx.restaurantId)).map((g) => ({
    id: g.id,
    name: g.name,
    defaultPaymentTermsDays: g.defaultPaymentTermsDays,
    defaultDiscountPercent: numOrNull(g.defaultDiscountPercent),
    notes: g.notes,
    customerCount: g._count.customers,
  }));

export const createCustomerGroup = async (
  ctx: SellingContext,
  input: CreateCustomerGroupInput,
): Promise<CustomerGroupDTO> => {
  const existing = await findCustomerGroupByName(ctx.restaurantId, input.name);
  if (existing && !existing.deletedAt) {
    throw new Error(CUSTOMER_GROUP_NAME_TAKEN);
  }
  const group = await createCustomerGroupRepo(ctx.restaurantId, {
    name: input.name,
    defaultPaymentTermsDays: input.defaultPaymentTermsDays ?? null,
    defaultDiscountPercent: input.defaultDiscountPercent ?? null,
    notes: input.notes ?? null,
  });
  return {
    id: group.id,
    name: group.name,
    defaultPaymentTermsDays: group.defaultPaymentTermsDays,
    defaultDiscountPercent: numOrNull(group.defaultDiscountPercent),
    notes: group.notes,
    customerCount: 0,
  };
};

export const updateCustomerGroup = async (
  ctx: SellingContext,
  input: UpdateCustomerGroupInput,
): Promise<CustomerGroupDTO> => {
  const group = await findCustomerGroupById(input.id);
  if (!group || group.deletedAt || group.restaurantId !== ctx.restaurantId) {
    throw new Error(CUSTOMER_GROUP_NOT_FOUND);
  }
  const updated = await updateCustomerGroupRepo(group.id, {
    name: input.name,
    defaultPaymentTermsDays: input.defaultPaymentTermsDays ?? null,
    defaultDiscountPercent: input.defaultDiscountPercent ?? null,
    notes: input.notes ?? null,
  });
  return {
    id: updated.id,
    name: updated.name,
    defaultPaymentTermsDays: updated.defaultPaymentTermsDays,
    defaultDiscountPercent: numOrNull(updated.defaultDiscountPercent),
    notes: updated.notes,
    customerCount: await countCustomersInGroup(updated.id),
  };
};

export const deleteCustomerGroup = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  if ((await countCustomersInGroup(input.id)) > 0) {
    throw new Error(CUSTOMER_GROUP_IN_USE);
  }
  const group = await findCustomerGroupById(input.id);
  if (!group || group.deletedAt || group.restaurantId !== ctx.restaurantId) {
    throw new Error(CUSTOMER_GROUP_NOT_FOUND);
  }
  await softDeleteCustomerGroup(group.id);
};

// ------------------------------------------------------------- territory ---

export const listTerritories = async (
  ctx: SellingContext,
): Promise<TerritoryDTO[]> =>
  (await findTerritories(ctx.restaurantId)).map((t) => ({
    id: t.id,
    name: t.name,
    notes: t.notes,
    customerCount: t._count.customers,
  }));

export const createTerritory = async (
  ctx: SellingContext,
  input: CreateTerritoryInput,
): Promise<TerritoryDTO> => {
  const existing = await findTerritoryByName(ctx.restaurantId, input.name);
  if (existing && !existing.deletedAt) {
    throw new Error(TERRITORY_NAME_TAKEN);
  }
  const territory = await createTerritoryRepo(ctx.restaurantId, {
    name: input.name,
    notes: input.notes ?? null,
  });
  return {
    id: territory.id,
    name: territory.name,
    notes: territory.notes,
    customerCount: 0,
  };
};

export const updateTerritory = async (
  ctx: SellingContext,
  input: UpdateTerritoryInput,
): Promise<TerritoryDTO> => {
  const territory = await findTerritoryById(input.id);
  if (
    !territory ||
    territory.deletedAt ||
    territory.restaurantId !== ctx.restaurantId
  ) {
    throw new Error(TERRITORY_NOT_FOUND);
  }
  const updated = await updateTerritoryRepo(territory.id, {
    name: input.name,
    notes: input.notes ?? null,
  });
  return {
    id: updated.id,
    name: updated.name,
    notes: updated.notes,
    customerCount: await countCustomersInTerritory(updated.id),
  };
};

export const deleteTerritory = async (
  ctx: SellingContext,
  input: { id: string },
): Promise<void> => {
  if ((await countCustomersInTerritory(input.id)) > 0) {
    throw new Error(TERRITORY_IN_USE);
  }
  const territory = await findTerritoryById(input.id);
  if (
    !territory ||
    territory.deletedAt ||
    territory.restaurantId !== ctx.restaurantId
  ) {
    throw new Error(TERRITORY_NOT_FOUND);
  }
  await softDeleteTerritory(territory.id);
};

export { num };
