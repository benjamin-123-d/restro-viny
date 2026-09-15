import { IngredientManager } from "@/components/food-cost/ingredient-manager";
import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listIngredients } from "@/services/food-cost.service";

export const metadata = { title: "Ingrédients — Food cost" };

export default async function IngredientsPage() {
  const page = await getFoodCostPageContext();
  if (!page) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }
  const ingredients = await listIngredients(page.ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Ingrédients"
        description="Ce que vous achetez, dans votre unité d'achat, avec son coût net une fois paré."
      />
      <HelpBox
        defaultOpen={ingredients.every((i) => i.lastPurchasePrice == null)}
        title="Comment renseigner un ingrédient"
        steps={[
          "Indiquez l'unité d'achat réelle (panier, carton, sac) et combien d'unités d'usage elle contient : 1 panier = 8 000 g.",
          "Saisissez le dernier prix payé HT pour une unité d'achat. Chaque achat enregistré le met à jour.",
          "Réglez le taux de rendement : la part utilisable après épluchage ou parage. Laissez 100 % si rien ne se perd.",
          "Rangez chaque ingrédient dans son lieu : l'inventaire se fera dans cet ordre.",
        ]}
        tips={[
          "Coût net d'usage = (prix d'achat ÷ coefficient) ÷ taux de rendement. C'est ce coût que les fiches techniques utilisent.",
          "Sans rendement, le coût matière est sous-évalué de 10 à 35 %.",
        ]}
      />
      <IngredientManager ingredients={ingredients} canEdit={page.canEdit} />
    </div>
  );
}
