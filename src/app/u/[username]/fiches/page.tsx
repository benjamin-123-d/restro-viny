import { StaffShell } from "@/components/staff-app/staff-shell";
import { formatQuantity } from "@/lib/food-cost-format";
import { listRecipeCards } from "@/services/food-cost.service";

import { requireStaffScreen } from "../staff-page-context";

export const metadata = { title: "Fiches techniques" };

/**
 * The cards as the kitchen needs them: what goes in, and how much, for how
 * many portions. No prices — the staff app never shows what things cost.
 */
export default async function StaffRecipeCardsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { ctx, restaurant, screens, role } = await requireStaffScreen(username, "FICHES");
  const cards = (await listRecipeCards({ restaurantId: ctx.restaurantId, userId: ctx.staffId })).filter(
    (card) => card.lines.length > 0,
  );

  return (
    <StaffShell
      username={restaurant.username}
      staffName={ctx.name}
      role={role}
      screens={screens}
      current="FICHES"
      title="Fiches techniques"
      subtitle="Les quantités de chaque plat"
    >
      {cards.length === 0 ? (
        <p className="rounded-xl bg-muted/60 p-4 text-base">
          Aucune fiche technique pour l&apos;instant. Le responsable les prépare depuis Food cost.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((card) => (
            <li key={card.menuItemId} className="rounded-xl border bg-card p-4">
              <details>
                <summary className="cursor-pointer list-none">
                  <span className="text-lg font-semibold">{card.menuItemName}</span>
                  <span className="block text-sm text-muted-foreground">
                    pour {card.portions} portion{card.portions > 1 ? "s" : ""} · {card.lines.length} ingrédient
                    {card.lines.length > 1 ? "s" : ""}
                  </span>
                </summary>
                <ul className="mt-3 divide-y border-t pt-2">
                  {card.lines.map((line) => (
                    <li key={line.stockItemId} className="flex items-center justify-between gap-3 py-2 text-base">
                      <span>{line.name}</span>
                      <span className="font-medium tabular-nums">{formatQuantity(line.quantity, line.unit)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </StaffShell>
  );
}
