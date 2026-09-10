import { describe, expect, it } from "vitest";

import {
  can,
  canEdit,
  canRead,
  DEFAULT_ROLES,
  emptyPermissions,
  fullPermissions,
  isAtLeast,
  maxLevel,
  PERMISSION_MODULES,
  resolvePermissions,
  visibleModules,
  type RoleGrant,
} from "./permissions";

const role = (o: Partial<RoleGrant> = {}): RoleGrant => ({
  isAdmin: false,
  permissions: [],
  ...o,
});

describe("isAtLeast", () => {
  it("orders NONE below READ below EDIT", () => {
    expect(isAtLeast("EDIT", "READ")).toBe(true);
    expect(isAtLeast("READ", "READ")).toBe(true);
    expect(isAtLeast("READ", "EDIT")).toBe(false);
    expect(isAtLeast("NONE", "READ")).toBe(false);
  });
});

describe("maxLevel", () => {
  it("keeps the stronger of two levels, either way round", () => {
    expect(maxLevel("READ", "EDIT")).toBe("EDIT");
    expect(maxLevel("EDIT", "READ")).toBe("EDIT");
    expect(maxLevel("NONE", "READ")).toBe("READ");
    expect(maxLevel("NONE", "NONE")).toBe("NONE");
  });
});

describe("resolvePermissions", () => {
  it("gives an owner everything, even with no roles at all", () => {
    const resolved = resolvePermissions({ isOwner: true, roles: [] });
    expect(resolved).toEqual(fullPermissions());
  });

  it("gives an owner everything even if their roles say otherwise", () => {
    const resolved = resolvePermissions({
      isOwner: true,
      roles: [role({ permissions: [{ module: "SELLING", level: "NONE" }] })],
    });
    expect(resolved.SELLING).toBe("EDIT");
  });

  it("denies everything to someone with no roles", () => {
    expect(resolvePermissions({ isOwner: false, roles: [] })).toEqual(
      emptyPermissions(),
    );
  });

  it("grants everything through a single admin role", () => {
    const resolved = resolvePermissions({
      isOwner: false,
      roles: [role({ isAdmin: true })],
    });
    expect(resolved).toEqual(fullPermissions());
  });

  it("applies a role's per-module grants", () => {
    const resolved = resolvePermissions({
      isOwner: false,
      roles: [
        role({
          permissions: [
            { module: "PURCHASING", level: "EDIT" },
            { module: "SELLING", level: "READ" },
          ],
        }),
      ],
    });
    expect(resolved.PURCHASING).toBe("EDIT");
    expect(resolved.SELLING).toBe("READ");
    expect(resolved.SETTINGS).toBe("NONE");
  });

  it("takes the highest level when two roles overlap", () => {
    const resolved = resolvePermissions({
      isOwner: false,
      roles: [
        role({ permissions: [{ module: "STOCK", level: "READ" }] }),
        role({ permissions: [{ module: "STOCK", level: "EDIT" }] }),
      ],
    });
    expect(resolved.STOCK).toBe("EDIT");
  });

  it("never lets one role take away what another granted", () => {
    const resolved = resolvePermissions({
      isOwner: false,
      roles: [
        role({ permissions: [{ module: "STOCK", level: "EDIT" }] }),
        role({ permissions: [{ module: "STOCK", level: "NONE" }] }),
      ],
    });
    expect(resolved.STOCK).toBe("EDIT");
  });

  it("unions across roles that cover different modules", () => {
    const resolved = resolvePermissions({
      isOwner: false,
      roles: [
        role({ permissions: [{ module: "PURCHASING", level: "EDIT" }] }),
        role({ permissions: [{ module: "MENU", level: "READ" }] }),
      ],
    });
    expect(resolved.PURCHASING).toBe("EDIT");
    expect(resolved.MENU).toBe("READ");
  });
});

describe("can / canRead / canEdit", () => {
  const ctx = {
    permissions: resolvePermissions({
      isOwner: false,
      roles: [
        role({
          permissions: [
            { module: "PURCHASING", level: "EDIT" },
            { module: "SELLING", level: "READ" },
          ],
        }),
      ],
    }),
  };

  it("lets EDIT do both reading and editing", () => {
    expect(canRead(ctx, "PURCHASING")).toBe(true);
    expect(canEdit(ctx, "PURCHASING")).toBe(true);
  });

  it("lets READ read but not edit", () => {
    expect(canRead(ctx, "SELLING")).toBe(true);
    expect(canEdit(ctx, "SELLING")).toBe(false);
  });

  it("refuses a module that was never granted", () => {
    expect(can(ctx, "SETTINGS", "READ")).toBe(false);
  });
});

describe("visibleModules", () => {
  it("lists only what the member can at least open", () => {
    const ctx = {
      permissions: resolvePermissions({
        isOwner: false,
        roles: [
          role({
            permissions: [
              { module: "PURCHASING", level: "EDIT" },
              { module: "STOCK", level: "READ" },
              { module: "MENU", level: "NONE" },
            ],
          }),
        ],
      }),
    };
    expect(visibleModules(ctx)).toEqual(["PURCHASING", "STOCK"]);
  });

  it("shows an owner every module", () => {
    const ctx = { permissions: resolvePermissions({ isOwner: true, roles: [] }) };
    expect(visibleModules(ctx)).toHaveLength(PERMISSION_MODULES.length);
  });
});

describe("DEFAULT_ROLES", () => {
  it("ships exactly one admin role", () => {
    expect(DEFAULT_ROLES.filter((r) => r.isAdmin)).toHaveLength(1);
  });

  it("gives every role a distinct name and rank", () => {
    expect(new Set(DEFAULT_ROLES.map((r) => r.name)).size).toBe(
      DEFAULT_ROLES.length,
    );
    expect(new Set(DEFAULT_ROLES.map((r) => r.rank)).size).toBe(
      DEFAULT_ROLES.length,
    );
  });

  it("never grants SETTINGS outside the admin role", () => {
    for (const r of DEFAULT_ROLES) {
      if (r.isAdmin) continue;
      expect(r.permissions.SETTINGS ?? "NONE").toBe("NONE");
    }
  });

  it("keeps the Viewer role read-only everywhere", () => {
    const viewer = DEFAULT_ROLES.find((r) => r.name === "Viewer");
    expect(viewer).toBeDefined();
    for (const level of Object.values(viewer?.permissions ?? {})) {
      expect(level).toBe("READ");
    }
  });

  it("only names modules that actually exist", () => {
    for (const r of DEFAULT_ROLES) {
      for (const key of Object.keys(r.permissions)) {
        expect(PERMISSION_MODULES).toContain(key);
      }
    }
  });
});
