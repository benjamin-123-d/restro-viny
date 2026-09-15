import Link from "next/link";

import { createRfqAction } from "@/actions/purchasing-sourcing.actions";
import { HelpBox } from "@/components/forms/help-box";
import { QuantityDocumentForm } from "@/components/forms/quantity-document-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { UNIT_LABELS } from "@/lib/inventory";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listStock } from "@/services/stock.service";
import { listSuppliers } from "@/services/supplier.service";

export const metadata = { title: "Nouvelle demande de devis" };

export default async function NewRfqPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }
  const [suppliers, stock] = await Promise.all([listSuppliers(ctx, {}), listStock(ctx.restaurantId)]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/purchasing/rfq" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour aux demandes de devis
      </Link>
      <PageHeader title="Nouvelle demande de devis" description="La même liste pour plusieurs fournisseurs, pour comparer leurs prix ligne à ligne." />
      <HelpBox
        title="Comparer des fournisseurs"
        steps={[
          "Cochez les fournisseurs à consulter et listez les articles avec les quantités voulues.",
          "Enregistrez, puis envoyez la demande : par e-mail depuis « Devis reçus → Demander un devis », ou par téléphone.",
          "Saisissez chaque réponse comme devis de la demande : la comparaison met en évidence le meilleur prix.",
        ]}
      />
      <QuantityDocumentForm
        kind="RFQ"
        items={stock.filter((i) => i.isActive).map((i) => ({ id: i.id, label: i.name, unit: UNIT_LABELS[i.unit] }))}
        suppliers={suppliers.filter((s) => !s.disabled && !s.preventRfq).map((s) => ({ value: s.id, label: s.name }))}
        action={createRfqAction}
        redirectTo="/dashboard/purchasing/rfq"
      />
    </div>
  );
}
