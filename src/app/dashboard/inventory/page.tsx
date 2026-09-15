import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { QuickPurchaseSection } from "@/components/food-cost/quick-purchase-section";
import { InventoryManager } from "@/components/inventory/inventory-manager";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listStock } from "@/services/stock.service";

export default async function InventoryPage() {
  const page = await getFoodCostPageContext();
  const ctx = page?.ctx ?? (await getManagerContextOrNull());
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Inventaire"
          description="Le stock que vous gardez au restaurant."
        />
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant pour suivre le stock."
        />
      </div>
    );
  }

  const items = await listStock(ctx.restaurantId);
  return (
    <InventoryManager
      items={items}
      purchaseSection={page ? <QuickPurchaseSection ctx={page.ctx} canEdit={page.canEdit} limit={5} helpOpen={false} /> : null}
    />
  );
}
