import Link from "next/link";

import { createStockReconciliationAction } from "@/actions/stock-advanced.actions";
import { HelpBox } from "@/components/forms/help-box";
import { QuantityDocumentForm } from "@/components/forms/quantity-document-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { UNIT_LABELS } from "@/lib/inventory";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listWarehouses } from "@/services/stock-advanced.service";
import { listStock } from "@/services/stock.service";

export const metadata = { title: "Nouveau comptage" };

export default async function NewStockCountPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }
  const [warehouses, stock] = await Promise.all([listWarehouses(ctx), listStock(ctx.restaurantId)]);
  const usable = warehouses.filter((w) => !w.isGroup);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/stock/counts" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour aux comptages
      </Link>
      <PageHeader title="Nouveau comptage d'entrepôt" description="Recaler le stock d'un entrepôt sur ce qui est réellement sur les étagères." />
      <HelpBox
        title="Compter un entrepôt"
        steps={[
          "Choisissez l'entrepôt compté.",
          "Saisissez la quantité trouvée pour chaque article.",
          "Enregistrez puis validez : l'écart est passé en correction et valorisé.",
        ]}
        tips={["Pour le food cost (écart théorique / réel), utilisez plutôt Food cost → Inventaire, qui fonctionne aussi hors ligne."]}
      />
      {usable.length === 0 ? (
        <EmptyState title="Aucun entrepôt" description="Créez d'abord un entrepôt dans Stock → Entrepôts." />
      ) : (
        <QuantityDocumentForm
          kind="COUNT"
          items={stock.filter((i) => i.isActive).map((i) => ({ id: i.id, label: i.name, unit: UNIT_LABELS[i.unit] }))}
          warehouses={usable.map((w) => ({ value: w.id, label: w.name }))}
          action={createStockReconciliationAction}
          redirectTo="/dashboard/stock/counts"
        />
      )}
    </div>
  );
}
