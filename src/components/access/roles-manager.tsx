"use client";

import { useState, useTransition } from "react";

import {
  assignMemberRolesAction,
  createRoleAction,
  deleteRoleAction,
  inviteMemberAction,
  removeMemberAction,
  updateRoleAction,
} from "@/actions/access.actions";
import {
  MODULE_LABEL,
  PERMISSION_MODULES,
  type PermissionLevel,
  type PermissionModule,
} from "@/lib/permissions";
import type { MemberDTO, RoleDTO } from "@/services/access.service";

const LEVELS: readonly { value: PermissionLevel; label: string }[] = [
  { value: "NONE", label: "No access" },
  { value: "READ", label: "Read" },
  { value: "EDIT", label: "Edit" },
];

const LEVEL_CLASS: Readonly<Record<PermissionLevel, string>> = {
  NONE: "bg-zinc-100 text-zinc-500",
  READ: "bg-blue-100 text-blue-700",
  EDIT: "bg-green-100 text-green-700",
};

const DEFAULT_COLOR = "#6B7280";

interface Draft {
  id: string | null;
  name: string;
  color: string;
  rank: number;
  isAdmin: boolean;
  description: string;
  permissions: Record<PermissionModule, PermissionLevel>;
}

const blankPermissions = (): Record<PermissionModule, PermissionLevel> =>
  Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m, "NONE" as PermissionLevel]),
  ) as Record<PermissionModule, PermissionLevel>;

const draftFrom = (role: RoleDTO): Draft => ({
  id: role.id,
  name: role.name,
  color: role.color ?? DEFAULT_COLOR,
  rank: role.rank,
  isAdmin: role.isAdmin,
  description: role.description ?? "",
  permissions: { ...role.permissions },
});

const newDraft = (): Draft => ({
  id: null,
  name: "",
  color: DEFAULT_COLOR,
  rank: 50,
  isAdmin: false,
  description: "",
  permissions: blankPermissions(),
});

/** A member's coloured role chips, highest-ranked first. */
const RoleChips = ({ member }: { member: MemberDTO }) => (
  <div className="flex flex-wrap gap-1">
    {member.isOwner && (
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
        Owner
      </span>
    )}
    {member.roles.map((role) => (
      <span
        key={role.id}
        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
        style={{ backgroundColor: role.color ?? DEFAULT_COLOR }}
      >
        {role.name}
      </span>
    ))}
    {!member.isOwner && member.roles.length === 0 && (
      <span className="text-xs text-zinc-400">no roles</span>
    )}
  </div>
);

export const RolesManager = ({
  initialRoles,
  initialMembers,
  canEdit,
}: {
  initialRoles: readonly RoleDTO[];
  initialMembers: readonly MemberDTO[];
  canEdit: boolean;
}) => {
  const [roles, setRoles] = useState<readonly RoleDTO[]>(initialRoles);
  const [members, setMembers] = useState<readonly MemberDTO[]>(initialMembers);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refreshMember = (updated: MemberDTO) =>
    setMembers((current) =>
      current.map((m) => (m.id === updated.id ? updated : m)),
    );

  const saveRole = () => {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const payload = {
        name: draft.name,
        color: draft.color,
        rank: draft.rank,
        isAdmin: draft.isAdmin,
        description: draft.description || undefined,
        permissions: PERMISSION_MODULES.map((m) => ({
          module: m,
          level: draft.permissions[m],
        })),
      };
      const result = draft.id
        ? await updateRoleAction({ ...payload, id: draft.id })
        : await createRoleAction(payload);

      if (!result.success || !result.data) {
        setError(result.error ?? "Could not save the role");
        return;
      }
      const saved = result.data;
      setRoles((current) =>
        draft.id
          ? current.map((r) => (r.id === saved.id ? saved : r))
          : [...current, saved].sort((a, b) => b.rank - a.rank),
      );
      setDraft(null);
    });
  };

  const removeRole = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await deleteRoleAction({ id });
      if (!result.success) {
        setError(result.error ?? "Could not delete the role");
        return;
      }
      setRoles((current) => current.filter((r) => r.id !== id));
    });
  };

  const invite = () => {
    setError(null);
    startTransition(async () => {
      const result = await inviteMemberAction({ handle });
      if (!result.success || !result.data) {
        setError(
          result.error === "USER_NOT_FOUND"
            ? "No account with that phone or email yet — they need to sign in once first."
            : result.error === "MEMBER_EXISTS"
              ? "That person is already a member."
              : (result.error ?? "Could not add the member"),
        );
        return;
      }
      setMembers((current) => [...current, result.data as MemberDTO]);
      setHandle("");
    });
  };

  const toggleRoleOnMember = (member: MemberDTO, roleId: string) => {
    setError(null);
    const has = member.roles.some((r) => r.id === roleId);
    const roleIds = has
      ? member.roles.filter((r) => r.id !== roleId).map((r) => r.id)
      : [...member.roles.map((r) => r.id), roleId];

    startTransition(async () => {
      const result = await assignMemberRolesAction({
        memberId: member.id,
        roleIds,
      });
      if (!result.success || !result.data) {
        setError(result.error ?? "Could not change the roles");
        return;
      }
      refreshMember(result.data);
    });
  };

  const kick = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction({ id });
      if (!result.success) {
        setError(result.error ?? "Could not remove the member");
        return;
      }
      setMembers((current) => current.filter((m) => m.id !== id));
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ------------------------------------------------------- members --- */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Members</h2>
          {canEdit && (
            <div className="flex gap-2">
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="+22997000000 or name@email.com"
                className="w-64 rounded-md border px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={invite}
                disabled={pending || handle.trim().length < 3}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Add member
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Roles</th>
                <th className="px-3 py-2 font-medium">Can edit</th>
                {canEdit && <th className="px-3 py-2 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const editable = PERMISSION_MODULES.filter(
                  (m) => member.permissions[m] === "EDIT",
                );
                return (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium text-zinc-900">
                        {member.displayName ?? member.name}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {member.phone}
                      </span>
                      {member.disabled && (
                        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                          disabled
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <RoleChips member={member} />
                      {canEdit && !member.isOwner && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {roles.map((role) => {
                            const has = member.roles.some(
                              (r) => r.id === role.id,
                            );
                            return (
                              <button
                                key={role.id}
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  toggleRoleOnMember(member, role.id)
                                }
                                className={`rounded-full border px-2 py-0.5 text-xs transition-colors disabled:opacity-40 ${
                                  has
                                    ? "border-zinc-900 bg-zinc-900 text-white"
                                    : "border-zinc-300 text-zinc-600 hover:border-zinc-500"
                                }`}
                              >
                                {has ? "−" : "+"} {role.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-600">
                      {member.isOwner
                        ? "Everything"
                        : editable.length === 0
                          ? "Nothing"
                          : editable.map((m) => MODULE_LABEL[m]).join(", ")}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2 text-right">
                        {!member.isOwner && (
                          <button
                            type="button"
                            onClick={() => kick(member.id)}
                            disabled={pending}
                            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* --------------------------------------------------------- roles --- */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Roles</h2>
          {canEdit && !draft && (
            <button
              type="button"
              onClick={() => setDraft(newDraft())}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
            >
              New role
            </button>
          )}
        </div>

        {draft && (
          <div className="flex flex-col gap-4 rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                Name
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                  className="w-56 rounded-md border px-3 py-1.5 text-sm text-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                Colour
                <input
                  type="color"
                  value={draft.color}
                  onChange={(e) =>
                    setDraft({ ...draft, color: e.target.value })
                  }
                  className="h-9 w-16 rounded-md border"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                Rank
                <input
                  type="number"
                  value={draft.rank}
                  onChange={(e) =>
                    setDraft({ ...draft, rank: Number(e.target.value) })
                  }
                  className="w-24 rounded-md border px-3 py-1.5 text-sm text-zinc-900"
                />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={draft.isAdmin}
                  onChange={(e) =>
                    setDraft({ ...draft, isAdmin: e.target.checked })
                  }
                />
                Administrator (grants everything)
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              Description
              <input
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                className="rounded-md border px-3 py-1.5 text-sm text-zinc-900"
              />
            </label>

            <div
              className={
                draft.isAdmin ? "pointer-events-none opacity-40" : undefined
              }
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Permissions
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PERMISSION_MODULES.map((module) => (
                  <div
                    key={module}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-sm text-zinc-700">
                      {MODULE_LABEL[module]}
                    </span>
                    <div className="flex gap-1">
                      {LEVELS.map((level) => (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              permissions: {
                                ...draft.permissions,
                                [module]: level.value,
                              },
                            })
                          }
                          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                            draft.permissions[module] === level.value
                              ? LEVEL_CLASS[level.value]
                              : "text-zinc-400 hover:bg-zinc-100"
                          }`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveRole}
                disabled={pending || draft.name.trim().length === 0}
                className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {pending ? "Saving…" : "Save role"}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-md border px-4 py-1.5 text-sm font-medium text-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {roles.map((role) => (
            <div key={role.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: role.color ?? DEFAULT_COLOR }}
                  >
                    {role.name}
                  </span>
                  {role.isAdmin && (
                    <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700">
                      admin
                    </span>
                  )}
                  {role.isSystem && (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                      built-in
                    </span>
                  )}
                  {role.description && (
                    <p className="mt-1.5 text-sm text-zinc-600">
                      {role.description}
                    </p>
                  )}
                </div>
                <span className="whitespace-nowrap text-xs text-zinc-500">
                  {role.memberCount} member{role.memberCount === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {PERMISSION_MODULES.filter(
                  (m) => role.permissions[m] !== "NONE",
                ).map((m) => (
                  <span
                    key={m}
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      LEVEL_CLASS[role.permissions[m]]
                    }`}
                  >
                    {MODULE_LABEL[m]} · {role.permissions[m].toLowerCase()}
                  </span>
                ))}
                {PERMISSION_MODULES.every(
                  (m) => role.permissions[m] === "NONE",
                ) && <span className="text-xs text-zinc-400">no access</span>}
              </div>

              {canEdit && (
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDraft(draftFrom(role))}
                    className="text-xs font-medium text-blue-700 hover:underline"
                  >
                    Edit
                  </button>
                  {!role.isSystem && role.memberCount === 0 && (
                    <button
                      type="button"
                      onClick={() => removeRole(role.id)}
                      disabled={pending}
                      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
