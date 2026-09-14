import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SalesDashboard } from "@/components/sales/sales-dashboard";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getSalesDashboard, isPeriodKey } from "@/services/sales-analytics.service";

export const metadata = { title: "Ventes" };

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="Ventes" description="Récapitulatif de vos ventes en caisse." />
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant."
        />
      </div>
    );
  }

  const { periode } = await searchParams;
  const data = await getSalesDashboard(ctx, isPeriodKey(periode) ? periode : "30j");

  return <SalesDashboard data={data} />;
}
