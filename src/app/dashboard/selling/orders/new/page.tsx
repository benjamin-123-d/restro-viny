import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { DocumentForm } from "@/components/forms/document-form";
import { createSalesOrderAction } from "@/actions/selling.actions";
import { listCustomers } from "@/services/customer.service";
import { listStock } from "@/services/stock.service";

export default async function NewSalesOrderPage() {
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

  const customers = (await listCustomers(ctx)).map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const catalogue = (await listStock(ctx.restaurantId))
    .filter((i) => i.isActive)
    .map((i) => ({ id: i.id, label: i.name, rate: 0, unit: i.unit }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link
        href="/dashboard/selling/orders"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux commandes
      </Link>
      <PageHeader
        title={"Nouvelle commande client"}
        description={
          "L'engagement ferme d'un client. La limite de crédit du client est vérifiée à l'enregistrement."
        }
      />
      <HelpBox
        title={"Le circuit d'une vente"}
        intro={"Devis → Commande → Livraison → Facture → Encaissement."}
        steps={[
          "Choisissez le client et la date de livraison.",
          "Ajoutez les lignes : un article du stock, ou une prestation décrite en texte libre.",
          "Enregistrez puis « Valider » depuis la liste.",
          "Livrez, facturez, puis enregistrez l'encaissement quand le client paie.",
        ]}
        tips={[
          "Si le client a dépassé sa limite de crédit, l'enregistrement est refusé avec un message clair.",
        ]}
      />
      <DocumentForm
        config={{
          partyField: "customerId",
          partyLabel: "Client",
          partyHint: "Le client qui passe commande.",
          parties: customers,
          dateField: "deliveryDate",
          dateLabel: "À livrer le",
          dateHint:
            "Les commandes non livrées à cette date sont signalées en retard.",
          lineMode: "sales",
          catalogue,
          defaultTaxRate: 18,
          withDiscount: true,
          extraText: {
            name: "poNumber",
            label: "N° de bon de commande du client",
            hint: "Sa propre référence, souvent exigée sur la facture.",
          },
        }}
        action={createSalesOrderAction}
        submitLabel={"Enregistrer la commande"}
        redirectTo="/dashboard/selling/orders"
      />
    </div>
  );
}
