import Link from "next/link";
import { notFound } from "next/navigation";

import { InventoryCounter } from "@/components/food-cost/inventory-counter";
import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { PageHeader } from "@/components/shared/page-header";
import { formatDateTime } from "@/lib/format";
import { getInventory } from "@/services/food-cost.service";

export const metadata = { title: "Comptage — Inventaire" };

export default async function FoodInventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await getFoodCostPageContext();
  if (!page) notFound();
  const { id } = await params;
  const inventory = await getInventory(page.ctx, id).catch(() => null);
  if (!inventory) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 lg:p-6">
      <Link href="/dashboard/food-cost/inventaire" className="text-sm text-muted-foreground hover:text-foreground">
        ← Tous les inventaires
      </Link>
      <PageHeader
        title={inventory.status === "DRAFT" ? "Comptage en cours" : "Inventaire validé"}
        description={`Ouvert le ${formatDateTime(inventory.countedAt)}`}
      />
      <InventoryCounter inventory={inventory} canEdit={page.canEdit} />
    </div>
  );
}
