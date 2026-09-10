"use server";

/**
 * Roles and members. Every action here needs EDIT on SETTINGS — the ability to
 * hand out permissions is itself the most powerful permission, so it is never
 * granted by any of the seeded non-admin roles.
 */

import { withPermission } from "@/actions/helpers";
import {
  accessIdSchema,
  assignMemberRolesSchema,
  createRoleSchema,
  inviteMemberSchema,
  updateMemberSchema,
  updateRoleSchema,
} from "@/lib/validators/access";
import {
  assignMemberRoles,
  createRole,
  deleteRole,
  inviteMember,
  removeMember,
  updateMember,
  updateRole,
} from "@/services/access.service";

export const createRoleAction = withPermission(
  "SETTINGS",
  "EDIT",
  createRoleSchema,
  (data, ctx) => createRole(ctx, data),
);

export const updateRoleAction = withPermission(
  "SETTINGS",
  "EDIT",
  updateRoleSchema,
  (data, ctx) => updateRole(ctx, data),
);

export const deleteRoleAction = withPermission(
  "SETTINGS",
  "EDIT",
  accessIdSchema,
  (data, ctx) => deleteRole(ctx, data),
);

export const inviteMemberAction = withPermission(
  "SETTINGS",
  "EDIT",
  inviteMemberSchema,
  (data, ctx) => inviteMember(ctx, data),
);

export const updateMemberAction = withPermission(
  "SETTINGS",
  "EDIT",
  updateMemberSchema,
  (data, ctx) => updateMember(ctx, data),
);

export const removeMemberAction = withPermission(
  "SETTINGS",
  "EDIT",
  accessIdSchema,
  (data, ctx) => removeMember(ctx, data),
);

export const assignMemberRolesAction = withPermission(
  "SETTINGS",
  "EDIT",
  assignMemberRolesSchema,
  (data, ctx) => assignMemberRoles(ctx, data),
);
