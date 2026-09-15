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
          title="Rôles et accès"
          description="Qui peut voir et modifier quoi."
        />
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant."
        />
      </div>
    );
  }

  const access = await resolveAccess(ctx.userId, ctx.restaurantId);
  if (!access) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="Rôles et accès" description="" />
        <EmptyState
          title="Pas d'accès"
          description="Vous n'êtes pas membre de ce restaurant."
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
        title="Rôles et accès"
        description="Donnez des rôles aux personnes, et à chaque rôle un niveau par module : lecture, édition ou rien. Avec deux rôles, on cumule le meilleur des deux."
      />
      <RolesManager
        initialRoles={roles}
        initialMembers={members}
        canEdit={canEdit(access, "SETTINGS")}
      />
    </div>
  );
}
