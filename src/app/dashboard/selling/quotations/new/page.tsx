import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { DocumentForm } from "@/components/forms/document-form";
import { createSalesQuotationAction } from "@/actions/selling.actions";
import { listCustomers } from "@/services/customer.service";
import { listStock } from "@/services/stock.service";

export default async function NewSalesQuotationPage() {
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
        href="/dashboard/selling/quotations"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux devis
      </Link>
      <PageHeader
        title={"Nouveau devis"}
        description={
          "Proposez un prix à un client avant qu'il ne s'engage. S'il accepte, le devis se transforme en commande."
        }
      />
      <HelpBox
        title={"Faire un devis"}
        intro={
          "Idéal pour les traiteurs, mariages, séminaires : le client voit le prix, vous gardez une trace de ce qui a été proposé."
        }
        steps={[
          "Choisissez le client.",
          "Décrivez chaque prestation en texte libre (ex. « Buffet 60 couverts ») et fixez son prix.",
          "Fixez une date de validité.",
          "Enregistrez. Si le client refuse, marquez le devis « perdu » avec la raison : utile pour vos statistiques.",
        ]}
        tips={[
          "Le taux de transformation de vos devis s'affiche dans Statistiques.",
        ]}
      />
      <DocumentForm
        config={{
          partyField: "customerId",
          partyLabel: "Client",
          partyHint: "À qui vous faites l'offre.",
          parties: customers,
          dateField: "validUntil",
          dateLabel: "Valable jusqu'au",
          dateHint: "Après cette date le devis est marqué « expiré ».",
          lineMode: "sales",
          catalogue,
          defaultTaxRate: 18,
          withDiscount: true,
        }}
        action={createSalesQuotationAction}
        submitLabel={"Enregistrer le devis"}
        redirectTo="/dashboard/selling/quotations"
      />
    </div>
  );
}
