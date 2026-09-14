import Link from "next/link";

import { HelpBox } from "@/components/forms/help-box";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { PaymentForm } from "@/components/forms/payment-form";
import { createSupplierPaymentAction } from "@/actions/purchasing.actions";
import { listPayableInvoices } from "@/services/purchase-invoice.service";
import { listSuppliers } from "@/services/supplier.service";

export default async function NewSupplierPaymentPage() {
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

  const suppliers = await listSuppliers(ctx, {});
  // Open bills for every supplier, loaded once so switching supplier is instant.
  const entries = await Promise.all(
    suppliers.map(
      async (s) => [s.id, await listPayableInvoices(ctx, s.id)] as const,
    ),
  );
  const openInvoices = Object.fromEntries(entries);
  const parties = suppliers.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-6">
      <Link
        href="/dashboard/purchasing/payments"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Retour aux paiements
      </Link>
      <PageHeader
        title={"Payer un fournisseur"}
        description={
          "Enregistrez l'argent versé à un fournisseur et choisissez les factures qu'il solde."
        }
      />
      <HelpBox
        title={"Comment payer un fournisseur"}
        intro={""}
        steps={[
          "Choisissez le fournisseur : ses factures non réglées s'affichent, la plus ancienne en premier.",
          "Tapez le montant versé et le moyen (espèces, MoMo, virement…).",
          "Répartissez le montant sur les factures — le bouton « Tout » solde une facture d'un clic.",
          "Enregistrez : les factures passent à « Payée » ou « Partiellement payée ».",
        ]}
        tips={[
          "Vous pouvez payer plus que les factures ouvertes : le reste est gardé en compte.",
          "Notez la référence (n° de transaction MoMo, de chèque) pour vos rapprochements.",
        ]}
      />
      <PaymentForm
        direction="pay"
        parties={parties}
        openInvoices={openInvoices}
        action={createSupplierPaymentAction}
        redirectTo="/dashboard/purchasing/payments"
      />
    </div>
  );
}
