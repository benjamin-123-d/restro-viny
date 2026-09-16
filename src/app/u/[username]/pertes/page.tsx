import { StaffLossForm } from "@/components/staff-app/declare-forms";
import { StaffShell } from "@/components/staff-app/staff-shell";
import { listIngredients } from "@/services/food-cost.service";
import { getMenu } from "@/services/menu-item.service";

import { requireStaffScreen } from "../staff-page-context";

export const metadata = { title: "Déclarer une perte" };

export default async function StaffLossPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { ctx, restaurant, screens, role } = await requireStaffScreen(username, "PERTES");
  const [ingredients, menu] = await Promise.all([
    listIngredients({ restaurantId: ctx.restaurantId, userId: ctx.staffId }),
    getMenu(ctx.restaurantId),
  ]);

  return (
    <StaffShell
      username={restaurant.username}
      staffName={ctx.name}
      role={role}
      screens={screens}
      current="PERTES"
      title="Déclarer une perte"
      subtitle="Ce qui a été jeté, renversé, raté ou offert"
    >
      <StaffLossForm
        ingredients={ingredients
          .filter((i) => i.isActive && !i.isPreparation)
          .map((i) => ({ id: i.id, name: i.name, unit: i.unit }))}
        dishes={menu.items.filter((item) => item.available).map((item) => ({ id: item.id, name: item.name }))}
      />
    </StaffShell>
  );
}
