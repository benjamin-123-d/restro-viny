import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { StockEntryForm } from "@/components/forms/stock-entry-form";
import { createStockEntryAction } from "@/actions/stock-advanced.actions";
import { listWarehouses } from "@/services/stock-advanced.service";
import { listStock } from "@/services/stock.service";

export default async function NewStockEntryPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur d'associer votre restaurant."
        />
      </div>
    );
  }

  const [warehouseRows, stock] = await Promise.all([
    listWarehouses(ctx),
    listStock(ctx.restaurantId),
  ]);
  const warehouses = warehouseRows
    .filter((w) => !w.isGroup)
    .map((w) => ({ value: w.id, label: w.name }));
  const items = stock
    .filter((i) => i.isActive)
    .map((i) => ({
      id: i.id,
      label: i.name,
      rate: i.costPerUnit ?? 0,
      unit: i.unit,
    }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link
        href="/dashboard/stock/entries"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux écritures de stock
      </Link>
      <PageHeader
        title={"Nouvelle écriture de stock"}
        description={
          "Faites entrer, sortir ou déplacer du stock sans passer par un achat ou une vente."
        }
      />
      <HelpBox
        title={"Quand utiliser une écriture de stock"}
        intro={""}
        steps={[
          "Transfert : vous montez 60 bières de la réserve au bar → « Transfert », depuis « Main store » vers « Bar ».",
          "Sortie : 3 kg de poisson perdus → « Sortie de stock », depuis « Cold room ».",
          "Entrée : stock de départ ou don → « Entrée en stock », vers l'entrepôt voulu.",
          "Enregistrez, puis « Valider » dans la liste : c'est à ce moment que le stock bouge.",
        ]}
        tips={[
          "Les marchandises achetées à un fournisseur passent par une « réception », pas par ici.",
          "Un transfert ne change pas le stock total, seulement où il se trouve.",
        ]}
      />
      <StockEntryForm
        items={items}
        warehouses={warehouses}
        action={createStockEntryAction}
        redirectTo="/dashboard/stock/entries"
      />
    </div>
  );
}
