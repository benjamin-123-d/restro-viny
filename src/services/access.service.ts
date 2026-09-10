import {
  DEFAULT_ROLES,
  resolvePermissions,
  type AccessContext,
  type PermissionLevel,
  type PermissionModule,
} from "@/lib/permissions";
import type {
  AssignMemberRolesInput,
  CreateRoleInput,
  InviteMemberInput,
  UpdateMemberInput,
  UpdateRoleInput,
} from "@/lib/validators/access";
import {
  countMembersWithRole,
  countRoles,
  createMember,
  createRole as createRoleRepo,
  deleteMember,
  findMember,
  findMemberById,
  findMembers,
  findRoleById,
  findRoles,
  findUserByHandle,
  setMemberRoles,
  softDeleteRole,
  updateMember as updateMemberRepo,
  updateRole as updateRoleRepo,
  type MemberWithRoles,
  type RoleWithPermissions,
} from "@/repositories/access.repository";
import { findFirstRestaurantByOwner } from "@/repositories/restaurant.repository";

export const MEMBER_NOT_FOUND = "MEMBER_NOT_FOUND";
export const MEMBER_EXISTS = "MEMBER_EXISTS";
export const MEMBER_IS_OWNER = "MEMBER_IS_OWNER";
export const USER_NOT_FOUND = "USER_NOT_FOUND";
export const ROLE_NOT_FOUND = "ROLE_NOT_FOUND";
export const ROLE_NAME_TAKEN = "ROLE_NAME_TAKEN";
export const ROLE_IN_USE = "ROLE_IN_USE";
export const ROLE_IS_SYSTEM = "ROLE_IS_SYSTEM";
export const FORBIDDEN = "FORBIDDEN";

export interface MemberDTO {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly isOwner: boolean;
  readonly disabled: boolean;
  readonly joinedAt: string;
  readonly roles: readonly {
    readonly id: string;
    readonly name: string;
    readonly color: string | null;
    readonly isAdmin: boolean;
  }[];
  /** What this member can actually do, after combining their roles. */
  readonly permissions: Record<PermissionModule, PermissionLevel>;
}

export interface RoleDTO {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly rank: number;
  readonly isAdmin: boolean;
  readonly isSystem: boolean;
  readonly description: string | null;
  readonly memberCount: number;
  readonly permissions: Record<PermissionModule, PermissionLevel>;
}

const permissionMapFrom = (
  rows: readonly { module: PermissionModule; level: PermissionLevel }[],
  isAdmin: boolean,
): Record<PermissionModule, PermissionLevel> =>
  resolvePermissions({
    isOwner: false,
    roles: [{ isAdmin, permissions: rows }],
  });

export const mapRole = (r: RoleWithPermissions): RoleDTO => ({
  id: r.id,
  name: r.name,
  color: r.color,
  rank: r.rank,
  isAdmin: r.isAdmin,
  isSystem: r.isSystem,
  description: r.description,
  memberCount: r._count.members,
  permissions: permissionMapFrom(r.permissions, r.isAdmin),
});

export const mapMember = (m: MemberWithRoles): MemberDTO => ({
  id: m.id,
  userId: m.userId,
  name: m.user.name ?? m.user.phone,
  phone: m.user.phone,
  email: m.user.email,
  displayName: m.displayName,
  isOwner: m.isOwner,
  disabled: m.disabled,
  joinedAt: m.joinedAt.toISOString(),
  // Highest-ranked role first, so the member's primary badge reads correctly.
  roles: [...m.roles]
    .sort((a, b) => b.role.rank - a.role.rank)
    .map((mr) => ({
      id: mr.role.id,
      name: mr.role.name,
      color: mr.role.color,
      isAdmin: mr.role.isAdmin,
    })),
  permissions: resolvePermissions({
    isOwner: m.isOwner,
    roles: m.roles.map((mr) => ({
      isAdmin: mr.role.isAdmin,
      permissions: mr.role.permissions,
    })),
  }),
});

/**
 * Seed the default roles the first time a restaurant opens the roles screen.
 * Idempotent — if any role already exists, nothing is created.
 */
export const ensureDefaultRoles = async (
  restaurantId: string,
): Promise<void> => {
  if ((await countRoles(restaurantId)) > 0) return;
  for (const preset of DEFAULT_ROLES) {
    await createRoleRepo(
      restaurantId,
      {
        name: preset.name,
        color: preset.color,
        rank: preset.rank,
        isAdmin: preset.isAdmin,
        description: preset.description,
        isSystem: true,
      },
      Object.entries(preset.permissions).map(([module, level]) => ({
        module: module as PermissionModule,
        level: level as PermissionLevel,
      })),
    );
  }
};

/**
 * Make sure the restaurant's owner has a membership row. Ownership predates
 * this module, so the record is created lazily the first time it is needed
 * rather than in a data migration.
 */
export const ensureOwnerMembership = async (
  restaurantId: string,
  ownerId: string,
): Promise<MemberWithRoles> => {
  const existing = await findMember(restaurantId, ownerId);
  if (existing) return existing;
  return createMember({
    restaurantId,
    userId: ownerId,
    isOwner: true,
    displayName: null,
    invitedById: null,
  });
};

/**
 * Resolve what a signed-in user may do in a restaurant.
 *
 * Owners are recognised even without a membership row, so existing
 * installations keep working untouched. Everyone else needs an enabled
 * membership; a disabled one resolves to no access at all.
 */
export const resolveAccess = async (
  userId: string,
  restaurantId: string,
): Promise<AccessContext | null> => {
  const owned = await findFirstRestaurantByOwner(userId);
  if (owned?.id === restaurantId) {
    return {
      userId,
      restaurantId,
      isOwner: true,
      permissions: resolvePermissions({ isOwner: true, roles: [] }),
    };
  }

  const member = await findMember(restaurantId, userId);
  if (!member || member.disabled) return null;

  return {
    userId,
    restaurantId,
    isOwner: member.isOwner,
    permissions: resolvePermissions({
      isOwner: member.isOwner,
      roles: member.roles.map((mr) => ({
        isAdmin: mr.role.isAdmin,
        permissions: mr.role.permissions,
      })),
    }),
  };
};

// --------------------------------------------------------------- members ---

export interface AccessAdminContext {
  readonly restaurantId: string;
  readonly userId: string;
}

export const listMembers = async (
  ctx: AccessAdminContext,
): Promise<MemberDTO[]> => {
  await ensureOwnerMembership(ctx.restaurantId, ctx.userId);
  return (await findMembers(ctx.restaurantId)).map(mapMember);
};

/** Add an existing account to the restaurant by phone or email. */
export const inviteMember = async (
  ctx: AccessAdminContext,
  input: InviteMemberInput,
): Promise<MemberDTO> => {
  const user = await findUserByHandle(input.handle);
  if (!user) throw new Error(USER_NOT_FOUND);

  const existing = await findMember(ctx.restaurantId, user.id);
  if (existing) throw new Error(MEMBER_EXISTS);

  const member = await createMember({
    restaurantId: ctx.restaurantId,
    userId: user.id,
    isOwner: false,
    displayName: input.displayName ?? null,
    invitedById: ctx.userId,
  });

  if (input.roleIds && input.roleIds.length > 0) {
    await setMemberRoles(member.id, input.roleIds);
  }

  const fresh = await findMemberById(member.id);
  return mapMember(fresh ?? member);
};

const loadOwnedMember = async (
  restaurantId: string,
  id: string,
): Promise<MemberWithRoles> => {
  const member = await findMemberById(id);
  if (!member || member.restaurantId !== restaurantId) {
    throw new Error(MEMBER_NOT_FOUND);
  }
  return member;
};

export const updateMember = async (
  ctx: AccessAdminContext,
  input: UpdateMemberInput,
): Promise<MemberDTO> => {
  const member = await loadOwnedMember(ctx.restaurantId, input.id);
  // The owner must never be able to disable themselves out of their own shop.
  if (member.isOwner && input.disabled) {
    throw new Error(MEMBER_IS_OWNER);
  }
  await updateMemberRepo(member.id, {
    displayName: input.displayName ?? null,
    disabled: input.disabled,
  });
  return mapMember(await loadOwnedMember(ctx.restaurantId, input.id));
};

export const removeMember = async (
  ctx: AccessAdminContext,
  input: { id: string },
): Promise<void> => {
  const member = await loadOwnedMember(ctx.restaurantId, input.id);
  if (member.isOwner) throw new Error(MEMBER_IS_OWNER);
  await deleteMember(member.id);
};

/** Replace the whole role set for a member, Discord-style. */
export const assignMemberRoles = async (
  ctx: AccessAdminContext,
  input: AssignMemberRolesInput,
): Promise<MemberDTO> => {
  const member = await loadOwnedMember(ctx.restaurantId, input.memberId);

  const roles = await findRoles(ctx.restaurantId);
  const known = new Set(roles.map((r) => r.id));
  for (const roleId of input.roleIds) {
    if (!known.has(roleId)) throw new Error(ROLE_NOT_FOUND);
  }

  await setMemberRoles(member.id, input.roleIds);
  return mapMember(await loadOwnedMember(ctx.restaurantId, input.memberId));
};

// ----------------------------------------------------------------- roles ---

export const listRoles = async (
  ctx: AccessAdminContext,
): Promise<RoleDTO[]> => {
  await ensureDefaultRoles(ctx.restaurantId);
  return (await findRoles(ctx.restaurantId)).map(mapRole);
};

export const createRole = async (
  ctx: AccessAdminContext,
  input: CreateRoleInput,
): Promise<RoleDTO> => {
  const roles = await findRoles(ctx.restaurantId);
  if (roles.some((r) => r.name.toLowerCase() === input.name.toLowerCase())) {
    throw new Error(ROLE_NAME_TAKEN);
  }
  return mapRole(
    await createRoleRepo(
      ctx.restaurantId,
      {
        name: input.name,
        color: input.color ?? null,
        rank: input.rank,
        isAdmin: input.isAdmin,
        description: input.description ?? null,
      },
      input.permissions,
    ),
  );
};

const loadOwnedRole = async (
  restaurantId: string,
  id: string,
): Promise<RoleWithPermissions> => {
  const role = await findRoleById(id);
  if (!role || role.deletedAt || role.restaurantId !== restaurantId) {
    throw new Error(ROLE_NOT_FOUND);
  }
  return role;
};

export const updateRole = async (
  ctx: AccessAdminContext,
  input: UpdateRoleInput,
): Promise<RoleDTO> => {
  const role = await loadOwnedRole(ctx.restaurantId, input.id);
  if (input.name.toLowerCase() !== role.name.toLowerCase()) {
    const roles = await findRoles(ctx.restaurantId);
    if (
      roles.some(
        (r) => r.id !== role.id && r.name.toLowerCase() === input.name.toLowerCase(),
      )
    ) {
      throw new Error(ROLE_NAME_TAKEN);
    }
  }
  return mapRole(
    await updateRoleRepo(
      role.id,
      {
        name: input.name,
        color: input.color ?? null,
        rank: input.rank,
        isAdmin: input.isAdmin,
        description: input.description ?? null,
      },
      input.permissions,
    ),
  );
};

/** System roles stay; a role someone still holds must be freed up first. */
export const deleteRole = async (
  ctx: AccessAdminContext,
  input: { id: string },
): Promise<void> => {
  const role = await loadOwnedRole(ctx.restaurantId, input.id);
  if (role.isSystem) throw new Error(ROLE_IS_SYSTEM);
  if ((await countMembersWithRole(role.id)) > 0) throw new Error(ROLE_IN_USE);
  await softDeleteRole(role.id);
};
