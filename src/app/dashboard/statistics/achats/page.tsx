import { PurchaseDashboard } from "@/components/statistics/purchase-dashboard";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getPurchaseDashboard } from "@/services/purchase-analytics.service";
import { isPeriodKey } from "@/services/sales-analytics.service";

export const metadata = { title: "Achats — Statistiques" };

export default async function PurchaseStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader title="Achats" description="Récapitulatif de ce que vous achetez." />
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant."
        />
      </div>
    );
  }

  const { periode } = await searchParams;
  const data = await getPurchaseDashboard(ctx, isPeriodKey(periode) ? periode : "30j");

  return <PurchaseDashboard data={data} />;
}
