import { DashboardView } from "@/components/dashboard/dashboard-view";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getDashboard } from "@/services/dashboard.service";
import { listOrders } from "@/services/order.service";
import { getLowStockCount } from "@/services/stock.service";

export default async function Page() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Tableau de bord"
          description="Votre restaurant en un coup d'œil."
        />
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant pour voir vos chiffres."
        />
      </div>
    );
  }

  const [data, lowStock, openOrders] = await Promise.all([
    getDashboard(ctx.restaurantId),
    getLowStockCount(ctx.restaurantId),
    listOrders(ctx.restaurantId, ["OPEN"]),
  ]);

  return <DashboardView data={data} lowStock={lowStock} openOrders={openOrders} />;
}
