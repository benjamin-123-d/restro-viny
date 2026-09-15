import Link from "next/link";
import { notFound } from "next/navigation";

import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { RecipeCardEditor } from "@/components/food-cost/recipe-card-editor";
import { PageHeader } from "@/components/shared/page-header";
import { getRecipeCard, getSubRecipesEnabled, listIngredients } from "@/services/food-cost.service";

export const metadata = { title: "Fiche technique — Food cost" };

export default async function RecipeCardPage({ params }: { params: Promise<{ menuItemId: string }> }) {
  const page = await getFoodCostPageContext();
  if (!page) notFound();
  const { menuItemId } = await params;
  const [card, ingredients, subRecipes] = await Promise.all([
    getRecipeCard(page.ctx, menuItemId).catch(() => null),
    listIngredients(page.ctx),
    getSubRecipesEnabled(page.ctx.restaurantId),
  ]);
  if (!card) notFound();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/food-cost/fiches" className="text-sm text-muted-foreground hover:text-foreground">
        ← Toutes les fiches
      </Link>
      <PageHeader
        title={card.menuItemName}
        description={`${card.categoryName} · fiche technique${card.hasCard ? "" : " à composer"}`}
      />
      <RecipeCardEditor
        card={card}
        ingredients={ingredients.filter((i) => i.isActive && (subRecipes || !i.isPreparation))}
        canEdit={page.canEdit}
      />
    </div>
  );
}
