import { StaffShell } from "@/components/staff-app/staff-shell";
import { StockCheckForm } from "@/components/staff-app/stock-check-form";
import { getStaffStock } from "@/services/staff-declarations.service";

import { requireStaffScreen } from "../staff-page-context";

export const metadata = { title: "Stock du matin" };

export default async function StaffStockPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { ctx, restaurant, screens, role } = await requireStaffScreen(username, "STOCK");
  const rows = await getStaffStock(ctx.restaurantId);

  return (
    <StaffShell
      username={restaurant.username}
      staffName={ctx.name}
      role={role}
      screens={screens}
      current="STOCK"
      title="Stock du matin"
      subtitle="Ce que l'application attend sur vos étagères"
    >
      {rows.length === 0 ? (
        <p className="rounded-xl bg-muted/60 p-4 text-base">
          Aucun ingrédient suivi pour l&apos;instant. Le responsable doit d&apos;abord les créer.
        </p>
      ) : (
        <StockCheckForm rows={rows} />
      )}
    </StaffShell>
  );
}
