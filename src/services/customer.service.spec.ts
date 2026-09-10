import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomerWithRefs } from "@/repositories/customer.repository";

vi.mock("@/repositories/customer.repository", () => ({
  countCustomersInGroup: vi.fn(),
  countCustomersInTerritory: vi.fn(),
  createCustomer: vi.fn(),
  createCustomerGroup: vi.fn(),
  createTerritory: vi.fn(),
  findCustomerById: vi.fn(),
  findCustomerByName: vi.fn(),
  findCustomerGroupById: vi.fn(),
  findCustomerGroupByName: vi.fn(),
  findCustomerGroups: vi.fn(),
  findCustomerMoneyRows: vi.fn(),
  findCustomers: vi.fn(),
  findTerritories: vi.fn(),
  findTerritoryById: vi.fn(),
  findTerritoryByName: vi.fn(),
  maxCustomerCode: vi.fn(),
  reviveCustomer: vi.fn(),
  softDeleteCustomer: vi.fn(),
  softDeleteCustomerGroup: vi.fn(),
  softDeleteTerritory: vi.fn(),
  updateCustomer: vi.fn(),
  updateCustomerGroup: vi.fn(),
  updateTerritory: vi.fn(),
}));

import {
  createCustomer as createCustomerRepo,
  findCustomerByName,
  findCustomerMoneyRows,
  findCustomers,
  maxCustomerCode,
  reviveCustomer,
} from "@/repositories/customer.repository";

import {
  assertCustomerCanOrder,
  createCustomer,
  CUSTOMER_DISABLED,
  CUSTOMER_NAME_TAKEN,
  CUSTOMER_OVER_CREDIT_LIMIT,
  listCustomers,
  mapCustomer,
} from "./customer.service";

const ctx = { restaurantId: "res_1", userId: "u1" };

const makeCustomer = (o: Record<string, unknown> = {}): CustomerWithRefs =>
  ({
    id: "cus_1",
    restaurantId: "res_1",
    code: "CUST-00001",
    name: "Hotel Azur",
    customerGroupId: null,
    customerGroup: null,
    territoryId: null,
    territory: null,
    taxId: null,
    contactPerson: null,
    email: null,
    phone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    currency: null,
    paymentTermsDays: null,
    creditLimit: null,
    blockOnCreditLimit: true,
    loyaltyPoints: 0,
    disabled: false,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...o,
  }) as unknown as CustomerWithRefs;

const baseInput = {
  name: "Hotel Azur",
  blockOnCreditLimit: true,
  disabled: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCustomer", () => {
  it("issues the next sequential code", async () => {
    vi.mocked(findCustomerByName).mockResolvedValue(null);
    vi.mocked(maxCustomerCode).mockResolvedValue(4);
    vi.mocked(createCustomerRepo).mockResolvedValue(makeCustomer());

    await createCustomer(ctx, baseInput as never);

    expect(createCustomerRepo).toHaveBeenCalledWith(
      "res_1",
      "CUST-00005",
      expect.objectContaining({ name: "Hotel Azur" }),
    );
  });

  it("rejects a duplicate name", async () => {
    vi.mocked(findCustomerByName).mockResolvedValue(makeCustomer());
    await expect(createCustomer(ctx, baseInput as never)).rejects.toThrow(
      CUSTOMER_NAME_TAKEN,
    );
  });

  it("revives a soft-deleted customer rather than duplicating", async () => {
    vi.mocked(findCustomerByName).mockResolvedValue(
      makeCustomer({ id: "cus_old", deletedAt: new Date() }),
    );
    vi.mocked(reviveCustomer).mockResolvedValue(makeCustomer());

    await createCustomer(ctx, baseInput as never);

    expect(reviveCustomer).toHaveBeenCalledWith("cus_old", expect.anything());
    expect(createCustomerRepo).not.toHaveBeenCalled();
  });
});

describe("assertCustomerCanOrder", () => {
  it("lets a healthy account through", () => {
    expect(() => assertCustomerCanOrder(makeCustomer(), 0)).not.toThrow();
  });

  it("refuses a disabled account outright", () => {
    expect(() =>
      assertCustomerCanOrder(makeCustomer({ disabled: true }), 0),
    ).toThrow(CUSTOMER_DISABLED);
  });

  it("blocks an order that would pass the credit limit", () => {
    const customer = makeCustomer({ creditLimit: 10000 });
    expect(() => assertCustomerCanOrder(customer, 8000, 3000)).toThrow(
      CUSTOMER_OVER_CREDIT_LIMIT,
    );
  });

  it("allows an order that stays within the limit", () => {
    const customer = makeCustomer({ creditLimit: 10000 });
    expect(() => assertCustomerCanOrder(customer, 8000, 1500)).not.toThrow();
  });

  it("treats a zero limit as no limit at all", () => {
    const customer = makeCustomer({ creditLimit: 0 });
    expect(() => assertCustomerCanOrder(customer, 999999, 1)).not.toThrow();
  });

  it("only warns, never blocks, when the owner turned blocking off", () => {
    const customer = makeCustomer({
      creditLimit: 1000,
      blockOnCreditLimit: false,
    });
    expect(() => assertCustomerCanOrder(customer, 5000, 5000)).not.toThrow();
  });
});

describe("listCustomers", () => {
  it("joins each customer to its receivables, defaulting to zeros", async () => {
    vi.mocked(findCustomers).mockResolvedValue([
      makeCustomer({ id: "cus_1" }),
      makeCustomer({ id: "cus_2", name: "Cafe Bleu" }),
    ]);
    vi.mocked(findCustomerMoneyRows).mockResolvedValue([
      {
        customerId: "cus_1",
        openOrderCount: 3,
        outstandingAmount: 25000,
        overdueAmount: 5000,
        totalSold: 120000,
        lastOrderDate: new Date("2026-08-01T00:00:00Z"),
      },
    ]);

    const rows = await listCustomers(ctx);

    expect(rows[0].outstandingAmount).toBe(25000);
    expect(rows[0].openOrderCount).toBe(3);
    expect(rows[1].outstandingAmount).toBe(0);
    expect(rows[1].lastOrderDate).toBeNull();
  });

  it("flags a customer past its credit limit and reports what is left", async () => {
    vi.mocked(findCustomers).mockResolvedValue([
      makeCustomer({ id: "cus_1", creditLimit: 10000 }),
    ]);
    vi.mocked(findCustomerMoneyRows).mockResolvedValue([
      {
        customerId: "cus_1",
        openOrderCount: 0,
        outstandingAmount: 12000,
        overdueAmount: 0,
        totalSold: 0,
        lastOrderDate: null,
      },
    ]);

    const [row] = await listCustomers(ctx);

    expect(row.overCreditLimit).toBe(true);
    expect(row.creditAvailable).toBe(-2000);
  });

  it("reports no credit ceiling when none is set", async () => {
    vi.mocked(findCustomers).mockResolvedValue([makeCustomer()]);
    vi.mocked(findCustomerMoneyRows).mockResolvedValue([]);

    const [row] = await listCustomers(ctx);

    expect(row.overCreditLimit).toBe(false);
    expect(row.creditAvailable).toBeNull();
  });
});

describe("mapCustomer", () => {
  it("surfaces group and territory names for display", () => {
    const dto = mapCustomer(
      makeCustomer({
        customerGroupId: "g1",
        customerGroup: { id: "g1", name: "Hotels" },
        territoryId: "t1",
        territory: { id: "t1", name: "Cotonou" },
      }),
    );
    expect(dto.customerGroupName).toBe("Hotels");
    expect(dto.territoryName).toBe("Cotonou");
  });
});
