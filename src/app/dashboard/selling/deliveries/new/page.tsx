import Link from "next/link";

import { createDeliveryNoteAction } from "@/actions/selling.actions";
import { DocumentForm } from "@/components/forms/document-form";
import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listCustomers } from "@/services/customer.service";
import { listStock } from "@/services/stock.service";

export const metadata = { title: "Nouveau bon de livraison" };

export default async function NewDeliveryNotePage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur d'associer votre restaurant." />
      </div>
    );
  }
  const [customers, stock] = await Promise.all([listCustomers(ctx), listStock(ctx.restaurantId)]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link href="/dashboard/selling/deliveries" className="text-sm text-muted-foreground hover:text-foreground">
        ← Retour aux livraisons
      </Link>
      <PageHeader title="Nouveau bon de livraison" description="Ce que vous remettez à un client professionnel (traiteur, événement)." />
      <HelpBox
        title="Livrer un client"
        steps={[
          "Choisissez le client et, si besoin, le nom du livreur.",
          "Listez les articles livrés : un produit du stock, ou un libellé libre (plateau, buffet…).",
          "Enregistrez, puis « Valider » : les articles de stock sortent de l'entrepôt. Facturez ensuite depuis Factures.",
        ]}
      />
      <DocumentForm
        config={{
          partyField: "customerId",
          partyLabel: "Client",
          partyHint: "Celui qui reçoit la livraison.",
          parties: customers.filter((c) => !c.disabled).map((c) => ({ value: c.id, label: c.name })),
          dateField: "postingDate",
          dateLabel: "Date de livraison",
          dateHint: "Vide : aujourd'hui.",
          lineMode: "sales",
          catalogue: stock.filter((i) => i.isActive).map((i) => ({ id: i.id, label: i.name, rate: 0, unit: i.unit })),
          defaultTaxRate: 10,
          extraText: { name: "driverName", label: "Livreur", hint: "Facultatif." },
        }}
        action={createDeliveryNoteAction}
        submitLabel="Enregistrer le bon de livraison"
        redirectTo="/dashboard/selling/deliveries"
      />
    </div>
  );
}
