import { z } from "zod";

import { PERMISSION_LEVELS, PERMISSION_MODULES } from "@/lib/permissions";
import { idSchema } from "@/lib/validators/shared";

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const permissionModuleSchema = z.enum(PERMISSION_MODULES);
export const permissionLevelSchema = z.enum(PERMISSION_LEVELS);

export const accessIdSchema = z.object({ id: idSchema });
export type AccessIdInput = z.infer<typeof accessIdSchema>;

// ----------------------------------------------------------------- roles ---

const permissionRowSchema = z.object({
  module: permissionModuleSchema,
  level: permissionLevelSchema,
});

const roleFields = {
  name: z.string().trim().min(1, "Give the role a name").max(60),
  /** Hex colour for the member badge. */
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #8B54FE")
    .optional(),
  rank: z.coerce.number().int().min(0).max(1000).default(0),
  isAdmin: z.boolean().default(false),
  description: optionalText(300),
  permissions: z
    .array(permissionRowSchema)
    .max(PERMISSION_MODULES.length)
    .default([])
    .refine(
      (rows) => new Set(rows.map((r) => r.module)).size === rows.length,
      { message: "A module appears twice" },
    ),
};

export const createRoleSchema = z.object(roleFields);
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({ ...roleFields, id: idSchema });
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// --------------------------------------------------------------- members ---

/**
 * Members are added by an identifier they already sign in with — a phone in
 * international format, or an email.
 */
export const inviteMemberSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(3, "Enter a phone number or email")
    .max(160)
    .refine(
      (v) => /^\+[1-9]\d{7,14}$/.test(v) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
      { message: "Enter a phone in international format, or an email" },
    ),
  displayName: optionalText(80),
  roleIds: z.array(idSchema).max(20).optional(),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({
  id: idSchema,
  displayName: optionalText(80),
  disabled: z.boolean().default(false),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const assignMemberRolesSchema = z.object({
  memberId: idSchema,
  roleIds: z.array(idSchema).max(20).default([]),
});
export type AssignMemberRolesInput = z.infer<typeof assignMemberRolesSchema>;
