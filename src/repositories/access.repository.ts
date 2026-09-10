import type {
  AppRole,
  PermissionLevel,
  PermissionModule,
  Prisma,
  RestaurantMember,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const memberDetail = {
  user: { select: { id: true, name: true, phone: true, email: true } },
  roles: {
    include: {
      role: { include: { permissions: true } },
    },
  },
} satisfies Prisma.RestaurantMemberInclude;

export type MemberWithRoles = Prisma.RestaurantMemberGetPayload<{
  include: typeof memberDetail;
}>;

export const findMember = (
  restaurantId: string,
  userId: string,
): Promise<MemberWithRoles | null> =>
  prisma.restaurantMember.findUnique({
    where: { restaurantId_userId: { restaurantId, userId } },
    include: memberDetail,
  });

export const findMembers = (
  restaurantId: string,
): Promise<MemberWithRoles[]> =>
  prisma.restaurantMember.findMany({
    where: { restaurantId },
    include: memberDetail,
    orderBy: [{ isOwner: "desc" }, { joinedAt: "asc" }],
  });

export const findMemberById = (
  id: string,
): Promise<MemberWithRoles | null> =>
  prisma.restaurantMember.findUnique({ where: { id }, include: memberDetail });

export const createMember = (data: {
  restaurantId: string;
  userId: string;
  isOwner: boolean;
  displayName: string | null;
  invitedById: string | null;
}): Promise<MemberWithRoles> =>
  prisma.restaurantMember.create({ data, include: memberDetail });

export const updateMember = (
  id: string,
  data: { displayName?: string | null; disabled?: boolean },
): Promise<RestaurantMember> =>
  prisma.restaurantMember.update({ where: { id }, data });

export const deleteMember = (id: string): Promise<void> =>
  prisma.restaurantMember.delete({ where: { id } }).then(() => undefined);

/** Find a user by the phone or email an owner typed into the invite box. */
export const findUserByHandle = (handle: string) =>
  prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ phone: handle }, { email: handle.toLowerCase() }],
    },
    select: { id: true, name: true, phone: true, email: true },
  });

// ----------------------------------------------------------------- roles ---

const roleDetail = {
  permissions: true,
  _count: { select: { members: true } },
} satisfies Prisma.AppRoleInclude;

export type RoleWithPermissions = Prisma.AppRoleGetPayload<{
  include: typeof roleDetail;
}>;

export const findRoles = (
  restaurantId: string,
): Promise<RoleWithPermissions[]> =>
  prisma.appRole.findMany({
    where: { restaurantId, deletedAt: null },
    include: roleDetail,
    orderBy: [{ rank: "desc" }, { name: "asc" }],
  });

export const findRoleById = (
  id: string,
): Promise<RoleWithPermissions | null> =>
  prisma.appRole.findUnique({ where: { id }, include: roleDetail });

export const countRoles = (restaurantId: string): Promise<number> =>
  prisma.appRole.count({ where: { restaurantId, deletedAt: null } });

export interface RoleWriteData {
  name: string;
  color: string | null;
  rank: number;
  isAdmin: boolean;
  description: string | null;
}

/**
 * Create a role and its permission rows together. Only levels above NONE are
 * stored — an absent row already means "no access", so the table stays small
 * and readable.
 */
export const createRole = (
  restaurantId: string,
  data: RoleWriteData & { isSystem?: boolean },
  permissions: readonly { module: PermissionModule; level: PermissionLevel }[],
): Promise<RoleWithPermissions> =>
  prisma.appRole.create({
    data: {
      restaurantId,
      ...data,
      permissions: {
        create: permissions
          .filter((p) => p.level !== "NONE")
          .map((p) => ({ module: p.module, level: p.level })),
      },
    },
    include: roleDetail,
  });

export const updateRole = (
  id: string,
  data: RoleWriteData,
  permissions: readonly { module: PermissionModule; level: PermissionLevel }[],
): Promise<RoleWithPermissions> =>
  prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    return tx.appRole.update({
      where: { id },
      data: {
        ...data,
        permissions: {
          create: permissions
            .filter((p) => p.level !== "NONE")
            .map((p) => ({ module: p.module, level: p.level })),
        },
      },
      include: roleDetail,
    });
  });

export const softDeleteRole = (id: string): Promise<AppRole> =>
  prisma.appRole.update({ where: { id }, data: { deletedAt: new Date() } });

export const countMembersWithRole = (roleId: string): Promise<number> =>
  prisma.memberRole.count({ where: { roleId } });

// --------------------------------------------------------- assignments ---

export const assignRole = (
  memberId: string,
  roleId: string,
): Promise<unknown> =>
  prisma.memberRole.upsert({
    where: { memberId_roleId: { memberId, roleId } },
    create: { memberId, roleId },
    update: {},
  });

export const unassignRole = (
  memberId: string,
  roleId: string,
): Promise<void> =>
  prisma.memberRole
    .deleteMany({ where: { memberId, roleId } })
    .then(() => undefined);

/** Replace a member's whole role set in one go. */
export const setMemberRoles = (
  memberId: string,
  roleIds: readonly string[],
): Promise<void> =>
  prisma.$transaction(async (tx) => {
    await tx.memberRole.deleteMany({ where: { memberId } });
    if (roleIds.length > 0) {
      await tx.memberRole.createMany({
        data: roleIds.map((roleId) => ({ memberId, roleId })),
      });
    }
  });
