import { TabBar } from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getSubRecipesEnabled } from "@/services/food-cost.service";

/**
 * The food cost loop in tab order: what is bought, what it becomes, what is
 * sold, what is counted — and the one figure it all leads to.
 */
export default async function FoodCostLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getManagerContextOrNull();
  const subRecipes = ctx ? await getSubRecipesEnabled(ctx.restaurantId) : false;

  const tabs = [
    { href: "/dashboard/food-cost", label: "Food cost" },
    { href: "/dashboard/food-cost/ingredients", label: "Ingrédients" },
    { href: "/dashboard/food-cost/fiches", label: "Fiches techniques" },
    ...(subRecipes ? [{ href: "/dashboard/food-cost/bases", label: "Bases" }] : []),
    { href: "/dashboard/food-cost/achats", label: "Achats" },
    { href: "/dashboard/food-cost/inventaire", label: "Inventaire" },
    { href: "/dashboard/food-cost/pertes", label: "Pertes" },
    { href: "/dashboard/food-cost/reglages", label: "Réglages" },
  ];

  return (
    <div className="flex flex-col">
      <TabBar tabs={tabs} />
      {children}
    </div>
  );
}
