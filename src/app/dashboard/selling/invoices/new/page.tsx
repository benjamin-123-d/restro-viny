import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { DocumentForm } from "@/components/forms/document-form";
import { createSalesInvoiceAction } from "@/actions/selling.actions";
import { listCustomers } from "@/services/customer.service";
import { listStock } from "@/services/stock.service";

export default async function NewSalesInvoicePage() {
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
        href="/dashboard/selling/invoices"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux factures
      </Link>
      <PageHeader
        title={"Nouvelle facture client"}
        description={
          "Facturez un client en compte. La facture s'imprime en original, duplicata et triplicata."
        }
      />
      <HelpBox
        title={"Faire une facture"}
        intro={""}
        steps={[
          "Choisissez le client.",
          "Ajoutez les lignes facturées et vérifiez le total TTC.",
          "Enregistrez, puis « Valider » depuis la liste : la facture devient une créance.",
          "Cliquez le numéro de la facture pour l'imprimer — choisissez Original, Duplicata ou Triplicata.",
        ]}
        tips={[
          "Une facture validée ne se modifie plus : en cas d'erreur, annulez-la et refaites-en une.",
          "Le duplicata porte le même numéro et le même montant : ce n'est jamais une seconde facture.",
        ]}
      />
      <DocumentForm
        config={{
          partyField: "customerId",
          partyLabel: "Client",
          partyHint: "Le client facturé.",
          parties: customers,
          dateField: "dueDate",
          dateLabel: "Date d'échéance",
          dateHint:
            "Laissez vide : calculée avec le délai de paiement du client.",
          lineMode: "sales",
          catalogue,
          defaultTaxRate: 18,
          withDiscount: true,
        }}
        action={createSalesInvoiceAction}
        submitLabel={"Enregistrer la facture"}
        redirectTo="/dashboard/selling/invoices"
      />
    </div>
  );
}
