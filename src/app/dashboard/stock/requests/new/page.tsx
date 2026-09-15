import Link from "next/link";

import { createMaterialRequestAction } from "@/actions/stock-advanced.actions";
import { HelpBox } from "@/components/forms/help-box";
import { QuantityDocumentForm } from "@/components/forms/quantity-document-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { UNIT_LABELS } from "@/lib/inventory";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listWarehouses } from "@/services/stock-advanced.service";
import { listStock } from "@/services/stock.service";

export const metadata = { title: "Nouvelle demande d'articles" };

export default async function NewMaterialRequestPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }
  const [warehouses, stock] = await Promise.all([listWarehouses(ctx), listStock(ctx.restaurantId)]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/stock/requests" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour aux demandes
      </Link>
      <PageHeader title="Nouvelle demande d'articles" description="Quand la cuisine ou le bar a besoin de marchandise." />
      <HelpBox
        title="Faire une demande"
        steps={[
          "Choisissez le type : à acheter, à transférer d'un entrepôt à l'autre, ou à sortir de la réserve.",
          "Listez les articles et les quantités nécessaires.",
          "Enregistrez puis validez : une demande « à acheter » peut devenir un bon de commande.",
        ]}
      />
      <QuantityDocumentForm
        kind="MATERIAL_REQUEST"
        items={stock.filter((i) => i.isActive).map((i) => ({ id: i.id, label: i.name, unit: UNIT_LABELS[i.unit] }))}
        warehouses={warehouses.filter((w) => !w.isGroup).map((w) => ({ value: w.id, label: w.name }))}
        action={createMaterialRequestAction}
        redirectTo="/dashboard/stock/requests"
      />
    </div>
  );
}
