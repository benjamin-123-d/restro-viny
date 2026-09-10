import { RolesManager } from "@/components/access/roles-manager";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { canEdit } from "@/lib/permissions";
import {
  listMembers,
  listRoles,
  resolveAccess,
} from "@/services/access.service";

export default async function RolesPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Roles & access"
          description="Decide who can see and change what."
        />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant."
        />
      </div>
    );
  }

  const access = await resolveAccess(ctx.userId, ctx.restaurantId);
  if (!access) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="Roles & access" description="" />
        <EmptyState
          title="No access"
          description="You are not a member of this restaurant."
        />
      </div>
    );
  }

  // `listRoles` seeds the built-in roles the first time this page is opened.
  const [roles, members] = await Promise.all([
    listRoles(ctx),
    listMembers(ctx),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Roles & access"
        description="Give people roles, and each role a level per area — read, edit, or nothing. Someone with two roles gets the best of both."
      />
      <RolesManager
        initialRoles={roles}
        initialMembers={members}
        canEdit={canEdit(access, "SETTINGS")}
      />
    </div>
  );
}
