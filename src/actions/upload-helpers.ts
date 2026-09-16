import type { ZodType } from "zod";

import { getManagerContextOrNull, type ManagerContext } from "@/lib/manager-auth";
import { can, type PermissionModule } from "@/lib/permissions";
import { resolveAccess } from "@/services/access.service";
import type { IncomingDocument } from "@/services/supplier-documents.service";

/**
 * Shared plumbing for actions that receive FormData with a file: the signed-in
 * manager's right to edit, the typed fields, the file, and Zod errors keyed
 * the way forms display them.
 */

export const editContext = async (module: PermissionModule): Promise<ManagerContext | string> => {
  const ctx = await getManagerContextOrNull();
  if (!ctx) return "NO_RESTAURANT";
  const access = await resolveAccess(ctx.userId, ctx.restaurantId);
  if (!access || !can(access, module, "EDIT")) return "FORBIDDEN";
  return ctx;
};

/** The typed fields of a form, without its files. */
export const fieldsOf = (formData: FormData): Record<string, string> => {
  const fields: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && key !== "file") fields[key] = value;
  });
  return fields;
};

export const fileOf = async (formData: FormData, key = "file"): Promise<IncomingDocument | null> => {
  const file = formData.get(key);
  if (!(file instanceof File) || file.size === 0) return null;
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    type: file.type,
    size: file.size,
    name: file.name,
  };
};

export const parseWith = <T>(schema: ZodType<T>, raw: unknown) => {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { data: parsed.data, fieldErrors: null };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    (fieldErrors[issue.path.map(String).join(".") || "form"] ??= []).push(issue.message);
  }
  return { data: null, fieldErrors };
};
