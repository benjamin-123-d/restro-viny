import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { EntityForm } from "@/components/forms/entity-form";
import { createWarehouseAction } from "@/actions/stock-advanced.actions";
import { listWarehouses } from "@/services/stock-advanced.service";

export default async function NewWarehousePage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur d'associer votre restaurant."
        />
      </div>
    );
  }

  const parents = (await listWarehouses(ctx))
    .filter((w) => w.isGroup)
    .map((w) => ({ value: w.id, label: w.name }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link
        href="/dashboard/stock/warehouses"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux entrepôts
      </Link>
      <PageHeader
        title={"Nouvel entrepôt"}
        description={
          "Un endroit où le stock est physiquement rangé : magasin principal, chambre froide, bar, second point de vente."
        }
      />
      <HelpBox
        title={"À quoi servent les entrepôts"}
        intro={
          "Avec plusieurs entrepôts, vous savez non seulement combien vous avez, mais où c'est : 40 bières au bar et 200 en réserve."
        }
        steps={[
          "Créez un entrepôt par lieu de stockage réel.",
          "Cochez « par défaut » sur celui où arrivent la plupart des livraisons.",
          "Déplacez ensuite le stock entre eux avec une « écriture de stock » de type transfert.",
        ]}
        tips={[
          "Un entrepôt qui contient encore du stock ne peut pas être supprimé : transférez-le d'abord.",
        ]}
      />
      <EntityForm
        sections={[
          {
            title: "Entrepôt",
            fields: [
              {
                name: "name",
                label: "Nom",
                type: "text",
                required: true,
                placeholder: "ex. Chambre froide",
                hint: "Un nom que toute l'équipe comprend.",
              },
              {
                name: "code",
                label: "Code court",
                type: "text",
                placeholder: "ex. FROID",
                hint: "Facultatif, pratique pour les étiquettes.",
              },
              {
                name: "parentId",
                label: "Rattaché à",
                type: "select",
                options: parents,
                hint: "Pour regrouper, ex. « Cuisine » contient « Chambre froide » et « Réserve ».",
              },
              { name: "city", label: "Ville", type: "text" },
              {
                name: "addressLine1",
                label: "Adresse",
                type: "text",
                span: "full",
              },
              {
                name: "isDefault",
                label: "Entrepôt par défaut",
                type: "checkbox",
                hint: "Proposé en premier dans les formulaires. Un seul peut l'être.",
              },
              {
                name: "isGroup",
                label: "Groupe (ne contient pas de stock lui-même)",
                type: "checkbox",
                hint: "Cochez seulement s'il sert à regrouper d'autres entrepôts.",
              },
            ],
          },
        ]}
        action={createWarehouseAction}
        submitLabel={"Créer l'entrepôt"}
        successMessage={"Entrepôt créé."}
        redirectTo="/dashboard/stock/warehouses"
      />
    </div>
  );
}
