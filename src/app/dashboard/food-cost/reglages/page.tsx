import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { SubRecipesToggle } from "@/components/food-cost/sub-recipes-toggle";
import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getSubRecipesEnabled } from "@/services/food-cost.service";

export const metadata = { title: "Réglages — Food cost" };

export default async function FoodCostSettingsPage() {
  const page = await getFoodCostPageContext();
  if (!page) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }
  const enabled = await getSubRecipesEnabled(page.ctx.restaurantId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 lg:p-6">
      <PageHeader title="Réglages du food cost" description="Choisissez comment votre cuisine gère ses préparations de base." />

      <section className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:p-5">
        <h2 className="text-base font-semibold">Sous-recettes (bases maison)</h2>
        <SubRecipesToggle enabled={enabled} canEdit={page.canEdit} />
        <HelpBox
          title="Comment on fait, dans chaque mode ?"
          steps={
            enabled
              ? [
                  "Onglet « Bases » : créez chaque base (sauce tomate, fond, pâte) avec sa fiche et la quantité qu'elle produit (ex. 2 L).",
                  "Quand vous la préparez, cliquez « Produire » : ses ingrédients sortent du stock, la base y entre à son coût.",
                  "Dans les fiches des plats, choisissez la base comme un ingrédient (« Base · Sauce tomate ») avec la quantité utilisée.",
                  "À la vente, c'est la base qui sort du stock, pas les tomates : le stock reste juste toute la journée.",
                  "À l'inventaire, comptez aussi les bases déjà préparées.",
                ]
              : [
                  "Chaque fiche technique liste directement les ingrédients bruts et leurs quantités.",
                  "À chaque vente, ces ingrédients sortent du stock : simple, sans étape de production.",
                  "Si vous préparez des sauces ou des fonds à l'avance, leurs ingrédients sortiront au moment des ventes, pas de la préparation : le stock théorique peut alors être décalé pendant la journée.",
                  "Passez en « Avec sous-recettes » dès que vos bases pèsent dans le coût ou que ce décalage vous gêne.",
                ]
          }
          tips={[
            "Vous pouvez changer de mode à tout moment : les fiches, ventes et inventaires déjà enregistrés sont conservés.",
            "Une base se prépare avec des ingrédients bruts uniquement (pas de base dans une base).",
          ]}
        />
      </section>
    </div>
  );
}
