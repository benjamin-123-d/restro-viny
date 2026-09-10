import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/access.repository", () => ({
  countMembersWithRole: vi.fn(),
  countRoles: vi.fn(),
  createMember: vi.fn(),
  createRole: vi.fn(),
  deleteMember: vi.fn(),
  findMember: vi.fn(),
  findMemberById: vi.fn(),
  findMembers: vi.fn(),
  findRoleById: vi.fn(),
  findRoles: vi.fn(),
  findUserByHandle: vi.fn(),
  setMemberRoles: vi.fn(),
  softDeleteRole: vi.fn(),
  updateMember: vi.fn(),
  updateRole: vi.fn(),
}));
vi.mock("@/repositories/restaurant.repository", () => ({
  findFirstRestaurantByOwner: vi.fn(),
}));

import {
  countMembersWithRole,
  countRoles,
  createMember,
  createRole as createRoleRepo,
  findMember,
  findMemberById,
  findRoleById,
  findRoles,
  findUserByHandle,
  setMemberRoles,
  softDeleteRole,
} from "@/repositories/access.repository";
import { findFirstRestaurantByOwner } from "@/repositories/restaurant.repository";

import {
  assignMemberRoles,
  deleteRole,
  ensureDefaultRoles,
  inviteMember,
  MEMBER_EXISTS,
  MEMBER_IS_OWNER,
  removeMember,
  resolveAccess,
  ROLE_IN_USE,
  ROLE_IS_SYSTEM,
  ROLE_NOT_FOUND,
  USER_NOT_FOUND,
} from "./access.service";

const ctx = { restaurantId: "res_1", userId: "u1" };

const makeRole = (o: Record<string, unknown> = {}) =>
  ({
    id: "role_1",
    restaurantId: "res_1",
    name: "Buyer",
    color: "#059669",
    rank: 60,
    isAdmin: false,
    isSystem: false,
    description: null,
    deletedAt: null,
    permissions: [{ module: "PURCHASING", level: "EDIT" }],
    _count: { members: 0 },
    ...o,
  }) as never;

const makeMember = (o: Record<string, unknown> = {}) =>
  ({
    id: "mem_1",
    restaurantId: "res_1",
    userId: "u2",
    isOwner: false,
    displayName: null,
    disabled: false,
    joinedAt: new Date(),
    user: { id: "u2", name: "Ada", phone: "+2299700", email: null },
    roles: [],
    ...o,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findFirstRestaurantByOwner).mockResolvedValue(null);
});

describe("resolveAccess", () => {
  it("gives the owner full access without needing a membership row", async () => {
    vi.mocked(findFirstRestaurantByOwner).mockResolvedValue({
      id: "res_1",
    } as never);

    const access = await resolveAccess("u1", "res_1");

    expect(access?.isOwner).toBe(true);
    expect(access?.permissions.SETTINGS).toBe("EDIT");
    expect(findMember).not.toHaveBeenCalled();
  });

  it("returns null for someone who is not a member", async () => {
    vi.mocked(findMember).mockResolvedValue(null);
    expect(await resolveAccess("u9", "res_1")).toBeNull();
  });

  it("returns null for a disabled member, whatever their roles say", async () => {
    vi.mocked(findMember).mockResolvedValue(
      makeMember({
        disabled: true,
        roles: [{ role: { isAdmin: true, permissions: [] } }],
      }),
    );
    expect(await resolveAccess("u2", "res_1")).toBeNull();
  });

  it("combines the roles a member holds", async () => {
    vi.mocked(findMember).mockResolvedValue(
      makeMember({
        roles: [
          {
            role: {
              isAdmin: false,
              permissions: [{ module: "PURCHASING", level: "READ" }],
            },
          },
          {
            role: {
              isAdmin: false,
              permissions: [
                { module: "PURCHASING", level: "EDIT" },
                { module: "STOCK", level: "READ" },
              ],
            },
          },
        ],
      }),
    );

    const access = await resolveAccess("u2", "res_1");

    expect(access?.permissions.PURCHASING).toBe("EDIT");
    expect(access?.permissions.STOCK).toBe("READ");
    expect(access?.permissions.SETTINGS).toBe("NONE");
  });
});

describe("ensureDefaultRoles", () => {
  it("seeds the built-in roles for a fresh restaurant", async () => {
    vi.mocked(countRoles).mockResolvedValue(0);
    vi.mocked(createRoleRepo).mockResolvedValue(makeRole());

    await ensureDefaultRoles("res_1");

    expect(createRoleRepo).toHaveBeenCalled();
    const names = vi
      .mocked(createRoleRepo)
      .mock.calls.map((c) => (c[1] as { name: string }).name);
    expect(names).toContain("Administrator");
    expect(names).toContain("Viewer");
  });

  it("does nothing when roles already exist", async () => {
    vi.mocked(countRoles).mockResolvedValue(6);
    await ensureDefaultRoles("res_1");
    expect(createRoleRepo).not.toHaveBeenCalled();
  });
});

describe("inviteMember", () => {
  it("refuses a handle with no account behind it", async () => {
    vi.mocked(findUserByHandle).mockResolvedValue(null);
    await expect(
      inviteMember(ctx, { handle: "+22997000000" }),
    ).rejects.toThrow(USER_NOT_FOUND);
  });

  it("refuses someone who is already a member", async () => {
    vi.mocked(findUserByHandle).mockResolvedValue({ id: "u2" } as never);
    vi.mocked(findMember).mockResolvedValue(makeMember());
    await expect(
      inviteMember(ctx, { handle: "+22997000000" }),
    ).rejects.toThrow(MEMBER_EXISTS);
  });

  it("adds the member and applies the roles chosen up front", async () => {
    vi.mocked(findUserByHandle).mockResolvedValue({ id: "u2" } as never);
    vi.mocked(findMember).mockResolvedValue(null);
    vi.mocked(createMember).mockResolvedValue(makeMember());
    vi.mocked(findMemberById).mockResolvedValue(makeMember());

    await inviteMember(ctx, {
      handle: "+22997000000",
      roleIds: ["role_1"],
    });

    expect(setMemberRoles).toHaveBeenCalledWith("mem_1", ["role_1"]);
  });
});

describe("assignMemberRoles", () => {
  it("rejects a role from another restaurant", async () => {
    vi.mocked(findMemberById).mockResolvedValue(makeMember());
    vi.mocked(findRoles).mockResolvedValue([makeRole({ id: "role_1" })]);

    await expect(
      assignMemberRoles(ctx, { memberId: "mem_1", roleIds: ["role_x"] }),
    ).rejects.toThrow(ROLE_NOT_FOUND);
    expect(setMemberRoles).not.toHaveBeenCalled();
  });

  it("replaces the member's whole role set", async () => {
    vi.mocked(findMemberById).mockResolvedValue(makeMember());
    vi.mocked(findRoles).mockResolvedValue([
      makeRole({ id: "role_1" }),
      makeRole({ id: "role_2" }),
    ]);

    await assignMemberRoles(ctx, {
      memberId: "mem_1",
      roleIds: ["role_1", "role_2"],
    });

    expect(setMemberRoles).toHaveBeenCalledWith("mem_1", ["role_1", "role_2"]);
  });

  it("clears every role when given an empty list", async () => {
    vi.mocked(findMemberById).mockResolvedValue(makeMember());
    vi.mocked(findRoles).mockResolvedValue([]);

    await assignMemberRoles(ctx, { memberId: "mem_1", roleIds: [] });

    expect(setMemberRoles).toHaveBeenCalledWith("mem_1", []);
  });
});

describe("removeMember", () => {
  it("never removes the owner", async () => {
    vi.mocked(findMemberById).mockResolvedValue(makeMember({ isOwner: true }));
    await expect(removeMember(ctx, { id: "mem_1" })).rejects.toThrow(
      MEMBER_IS_OWNER,
    );
  });
});

describe("deleteRole", () => {
  it("keeps built-in roles", async () => {
    vi.mocked(findRoleById).mockResolvedValue(makeRole({ isSystem: true }));
    await expect(deleteRole(ctx, { id: "role_1" })).rejects.toThrow(
      ROLE_IS_SYSTEM,
    );
  });

  it("refuses a role someone still holds", async () => {
    vi.mocked(findRoleById).mockResolvedValue(makeRole());
    vi.mocked(countMembersWithRole).mockResolvedValue(2);
    await expect(deleteRole(ctx, { id: "role_1" })).rejects.toThrow(
      ROLE_IN_USE,
    );
    expect(softDeleteRole).not.toHaveBeenCalled();
  });

  it("deletes a custom role nobody holds", async () => {
    vi.mocked(findRoleById).mockResolvedValue(makeRole());
    vi.mocked(countMembersWithRole).mockResolvedValue(0);
    vi.mocked(softDeleteRole).mockResolvedValue(makeRole());

    await deleteRole(ctx, { id: "role_1" });

    expect(softDeleteRole).toHaveBeenCalledWith("role_1");
  });
});
