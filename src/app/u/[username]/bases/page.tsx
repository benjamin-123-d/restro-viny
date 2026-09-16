import { StaffProductionForm } from "@/components/staff-app/production-form";
import { StaffShell } from "@/components/staff-app/staff-shell";
import { listPreparations } from "@/services/food-cost.service";

import { requireStaffScreen } from "../staff-page-context";

export const metadata = { title: "Bases produites" };

export default async function StaffBasesPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { ctx, restaurant, screens, role } = await requireStaffScreen(username, "BASES");
  const preparations = await listPreparations({ restaurantId: ctx.restaurantId, userId: ctx.staffId });

  return (
    <StaffShell
      username={restaurant.username}
      staffName={ctx.name}
      role={role}
      screens={screens}
      current="BASES"
      title="Bases produites"
      subtitle="Sauces, fonds, pâtes préparés à l'avance"
    >
      {preparations.length === 0 ? (
        <p className="rounded-xl bg-muted/60 p-4 text-base">
          Aucune base pour l&apos;instant. Le responsable les prépare depuis Food cost → Bases.
        </p>
      ) : (
        <StaffProductionForm
          preparations={preparations.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            batchYield: p.preparationYield,
          }))}
        />
      )}
    </StaffShell>
  );
}
