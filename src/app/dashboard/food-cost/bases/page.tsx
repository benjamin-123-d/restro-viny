import Link from "next/link";

import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { PreparationManager } from "@/components/food-cost/preparation-manager";
import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatQuantity } from "@/lib/food-cost-format";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  getSubRecipesEnabled,
  listIngredients,
  listPreparations,
  listProductions,
} from "@/services/food-cost.service";

export const metadata = { title: "Bases — Food cost" };

export default async function PreparationsPage() {
  const page = await getFoodCostPageContext();
  if (!page) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }
  const enabled = await getSubRecipesEnabled(page.ctx.restaurantId);
  if (!enabled) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title="Sous-recettes désactivées"
          description="Activez « Avec sous-recettes » dans les réglages du food cost pour gérer vos bases maison."
        />
        <p className="mt-4 text-center text-sm">
          <Link href="/dashboard/food-cost/reglages" className="underline">Ouvrir les réglages</Link>
        </p>
      </div>
    );
  }
  const [preparations, ingredients, productions] = await Promise.all([
    listPreparations(page.ctx),
    listIngredients(page.ctx),
    listProductions(page.ctx),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <PageHeader title="Bases maison" description="Sauces, fonds et pâtes préparés à l'avance : produits, stockés, puis utilisés dans les plats." />
      <HelpBox
        defaultOpen={preparations.length === 0}
        title="Travailler avec des bases"
        steps={[
          "Créez la base avec ses ingrédients bruts et la quantité que produit la recette (ex. 2 000 ml de sauce).",
          "Chaque fois que vous la préparez, indiquez la quantité et cliquez « Produire ».",
          "Dans les fiches des plats, ajoutez la base comme un ingrédient : c'est elle qui sortira du stock à la vente.",
        ]}
      />
      <PreparationManager
        preparations={preparations}
        ingredients={ingredients.filter((i) => i.isActive && !i.isPreparation)}
        canEdit={page.canEdit}
      />
      {productions.length > 0 ? (
        <section className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
          <h2 className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">Dernières productions</h2>
          <ul className="divide-y text-sm">
            {productions.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 px-4 py-2">
                <span>
                  {formatDateTime(p.producedAt)} · <strong>{p.preparationName}</strong> — {formatQuantity(p.quantity, p.unit)}
                </span>
                <span className="tabular-nums">{formatCurrency(p.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
