import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { PaymentForm } from "@/components/forms/payment-form";
import { createCustomerPaymentAction } from "@/actions/selling.actions";
import { listCustomers } from "@/services/customer.service";
import { listReceivableInvoices } from "@/services/sales.document.service";

export default async function NewCustomerPaymentPage() {
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

  const customers = await listCustomers(ctx);
  const entries = await Promise.all(
    customers.map(
      async (c) => [c.id, await listReceivableInvoices(ctx, c.id)] as const,
    ),
  );
  const openInvoices = Object.fromEntries(entries);
  const parties = customers.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link
        href="/dashboard/selling/payments"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux encaissements
      </Link>
      <PageHeader
        title={"Encaisser un client"}
        description={
          "Enregistrez l'argent reçu d'un client et choisissez les factures qu'il règle."
        }
      />
      <HelpBox
        title={"Comment enregistrer un encaissement"}
        intro={""}
        steps={[
          "Choisissez le client : ses factures impayées s'affichent, les plus en retard signalées en rouge.",
          "Tapez le montant reçu et le moyen de paiement.",
          "Répartissez sur les factures réglées (« Tout » pour solder une facture).",
          "Enregistrez : la créance du client diminue d'autant.",
        ]}
        tips={[
          "Un client qui paie une partie seulement : la facture passe à « Partiellement payée ».",
        ]}
      />
      <PaymentForm
        direction="receive"
        parties={parties}
        openInvoices={openInvoices}
        action={createCustomerPaymentAction}
        redirectTo="/dashboard/selling/payments"
      />
    </div>
  );
}
