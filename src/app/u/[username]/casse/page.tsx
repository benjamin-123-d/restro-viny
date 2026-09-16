import { BreakageForm } from "@/components/staff-app/declare-forms";
import { StaffShell } from "@/components/staff-app/staff-shell";
import { formatCurrency } from "@/lib/format";
import { listBreakages } from "@/services/staff-declarations.service";

import { requireStaffScreen } from "../staff-page-context";

export const metadata = { title: "Déclarer une casse" };

export default async function StaffBreakagePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { ctx, restaurant, screens, role } = await requireStaffScreen(username, "CASSE");
  const recent = (await listBreakages(ctx.restaurantId)).slice(0, 5);

  return (
    <StaffShell
      username={restaurant.username}
      staffName={ctx.name}
      role={role}
      screens={screens}
      current="CASSE"
      title="Déclarer une casse"
      subtitle="Verre, assiette, couvert, matériel"
    >
      <div className="flex flex-col gap-6">
        <BreakageForm />

        {recent.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold">Dernières déclarations</h2>
            <ul className="mt-2 divide-y rounded-xl border">
              {recent.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 p-3">
                  <span>
                    <span className="text-base font-medium">
                      {row.quantity.toLocaleString("fr-FR")} × {row.label}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {new Date(row.brokeAt).toLocaleString("fr-FR", {
                        timeZone: "Europe/Paris",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {row.declaredBy ? ` · ${row.declaredBy}` : ""}
                    </span>
                  </span>
                  {row.value > 0 ? <span className="tabular-nums text-muted-foreground">{formatCurrency(row.value)}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </StaffShell>
  );
}
