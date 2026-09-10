/**
 * Pure permission algebra. No IO — the resolution rules are deterministic and
 * exhaustively unit-tested, so the guards that depend on them can be trusted.
 *
 * Shaped like Discord: a member holds any number of roles, and their effective
 * level for a module is the highest any single role grants. Roles never take
 * access away from each other.
 */

export const PERMISSION_MODULES = [
  "PURCHASING",
  "SELLING",
  "STOCK",
  "INVENTORY",
  "MENU",
  "ORDERS",
  "TABLES",
  "STAFF",
  "REPORTS",
  "ACCOUNTING",
  "SETTINGS",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_LEVELS = ["NONE", "READ", "EDIT"] as const;

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

/** Levels are ordered, so "at least READ" is a numeric comparison. */
const RANK: Readonly<Record<PermissionLevel, number>> = {
  NONE: 0,
  READ: 1,
  EDIT: 2,
};

export const isAtLeast = (
  actual: PermissionLevel,
  required: PermissionLevel,
): boolean => RANK[actual] >= RANK[required];

/** The stronger of two levels. */
export const maxLevel = (
  a: PermissionLevel,
  b: PermissionLevel,
): PermissionLevel => (RANK[a] >= RANK[b] ? a : b);

/** Every module denied — the starting point, and what a stranger gets. */
export const emptyPermissions = (): Record<PermissionModule, PermissionLevel> =>
  Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m, "NONE" as PermissionLevel]),
  ) as Record<PermissionModule, PermissionLevel>;

/** Every module at EDIT — what an owner or an admin role gets. */
export const fullPermissions = (): Record<PermissionModule, PermissionLevel> =>
  Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m, "EDIT" as PermissionLevel]),
  ) as Record<PermissionModule, PermissionLevel>;

export interface RoleGrant {
  readonly isAdmin: boolean;
  readonly permissions: readonly {
    readonly module: PermissionModule;
    readonly level: PermissionLevel;
  }[];
}

/**
 * Combine every role a member holds into one permission map.
 *
 * The owner short-circuits to full access so a restaurant can never be locked
 * out of itself, and a single admin role does the same. Otherwise levels are
 * merged by taking the highest per module.
 */
export const resolvePermissions = (input: {
  readonly isOwner: boolean;
  readonly roles: readonly RoleGrant[];
}): Record<PermissionModule, PermissionLevel> => {
  if (input.isOwner) return fullPermissions();
  if (input.roles.some((r) => r.isAdmin)) return fullPermissions();

  const resolved = emptyPermissions();
  for (const role of input.roles) {
    for (const grant of role.permissions) {
      resolved[grant.module] = maxLevel(resolved[grant.module], grant.level);
    }
  }
  return resolved;
};

export interface AccessContext {
  readonly userId: string;
  readonly restaurantId: string;
  readonly isOwner: boolean;
  readonly permissions: Record<PermissionModule, PermissionLevel>;
}

export const can = (
  ctx: Pick<AccessContext, "permissions">,
  module: PermissionModule,
  required: PermissionLevel,
): boolean => isAtLeast(ctx.permissions[module], required);

export const canRead = (
  ctx: Pick<AccessContext, "permissions">,
  module: PermissionModule,
): boolean => can(ctx, module, "READ");

export const canEdit = (
  ctx: Pick<AccessContext, "permissions">,
  module: PermissionModule,
): boolean => can(ctx, module, "EDIT");

/** Modules the member can at least open, for building their navigation. */
export const visibleModules = (
  ctx: Pick<AccessContext, "permissions">,
): PermissionModule[] =>
  PERMISSION_MODULES.filter((m) => isAtLeast(ctx.permissions[m], "READ"));

/**
 * The roles seeded for a new restaurant. Deliberately few and recognisable —
 * an owner should not have to design a permission model before selling lunch.
 */
export const DEFAULT_ROLES: readonly {
  name: string;
  color: string;
  rank: number;
  isAdmin: boolean;
  description: string;
  permissions: Partial<Record<PermissionModule, PermissionLevel>>;
}[] = [
  {
    name: "Administrator",
    color: "#8B54FE",
    rank: 100,
    isAdmin: true,
    description: "Full access to everything, including roles and settings.",
    permissions: {},
  },
  {
    name: "Manager",
    color: "#2563EB",
    rank: 80,
    isAdmin: false,
    description: "Runs the day to day: buying, selling, stock and the menu.",
    permissions: {
      PURCHASING: "EDIT",
      SELLING: "EDIT",
      STOCK: "EDIT",
      INVENTORY: "EDIT",
      MENU: "EDIT",
      ORDERS: "EDIT",
      TABLES: "EDIT",
      STAFF: "READ",
      REPORTS: "READ",
    },
  },
  {
    name: "Buyer",
    color: "#059669",
    rank: 60,
    isAdmin: false,
    description: "Raises orders and receives deliveries.",
    permissions: {
      PURCHASING: "EDIT",
      STOCK: "EDIT",
      INVENTORY: "EDIT",
      REPORTS: "READ",
    },
  },
  {
    name: "Stores clerk",
    color: "#D97706",
    rank: 40,
    isAdmin: false,
    description: "Counts and moves stock, but does not set prices.",
    permissions: {
      STOCK: "EDIT",
      INVENTORY: "EDIT",
      PURCHASING: "READ",
    },
  },
  {
    name: "Accountant",
    color: "#4B5563",
    rank: 30,
    isAdmin: false,
    description: "Sees the money without changing operations.",
    permissions: {
      PURCHASING: "READ",
      SELLING: "READ",
      STOCK: "READ",
      INVENTORY: "READ",
      ORDERS: "READ",
      REPORTS: "READ",
      ACCOUNTING: "EDIT",
    },
  },
  {
    name: "Viewer",
    color: "#6B7280",
    rank: 10,
    isAdmin: false,
    description: "Read-only across the business.",
    permissions: {
      PURCHASING: "READ",
      SELLING: "READ",
      STOCK: "READ",
      INVENTORY: "READ",
      MENU: "READ",
      ORDERS: "READ",
      TABLES: "READ",
      REPORTS: "READ",
    },
  },
];

/** Human labels for the module list, used by the permission matrix. */
export const MODULE_LABEL: Readonly<Record<PermissionModule, string>> = {
  PURCHASING: "Purchasing",
  SELLING: "Selling",
  STOCK: "Stock",
  INVENTORY: "Inventory",
  MENU: "Menu",
  ORDERS: "Orders & POS",
  TABLES: "Tables",
  STAFF: "Staff",
  REPORTS: "Reports",
  ACCOUNTING: "Accounting",
  SETTINGS: "Settings",
};
