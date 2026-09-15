import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocNumber,
  DocTable,
  Money,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listSupplierPayments } from "@/services/supplier-payment.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
const MODE_LABEL: Readonly<Record<string, string>> = {
  CASH: "Espèces",
  UPI: "Virement instantané",
  CARD: "Carte bancaire",
  OTHER: "Autre",
  BANK_TRANSFER: "Virement",
  CHEQUE: "Chèque",
  MOBILE_MONEY: "Mobile money",
  MEAL_VOUCHER: "Titre-restaurant",
};

export default async function SupplierPaymentsPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant."
        />
      </div>
    );
  }

  const payments = await listSupplierPayments(ctx);
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Paiements fournisseurs"
        description="L'argent versé, et les factures réglées par chaque paiement."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/purchasing/payments/new"
          label="Payer un fournisseur"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Paiements fournisseurs"
        intro=""
        steps={[
          "« Payer un fournisseur » pour enregistrer un versement.",
          "« Settles » liste les factures soldées par chaque paiement.",
          "« Unallocated » = argent versé mais pas encore affecté à une facture.",
        ]}
        tips={[]}
      />
      {payments.length === 0 ? (
        <EmptyState
          title="Aucun paiement"
          description="Réglez une facture fournisseur ouverte pour l'enregistrer ici."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Fournisseur" },
            { label: "Date" },
            { label: "Mode" },
            { label: "Référence" },
            { label: "Règle" },
            { label: "Non affecté", align: "right" },
            { label: "Montant", align: "right" },
          ]}
        >
          {payments.map((payment) => (
            <tr key={payment.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={payment.number} />
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {payment.supplierName}
              </td>
              <td className="px-3 py-2">
                <DocDate iso={payment.paymentDate} />
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {MODE_LABEL[payment.mode] ?? payment.mode}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {payment.referenceNo ?? "—"}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {payment.allocations.length === 0
                  ? "Acompte non affecté"
                  : payment.allocations.map((a) => a.invoiceNumber).join(", ")}
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={payment.unallocatedAmount}
                  tone={payment.unallocatedAmount === 0 ? "muted" : undefined}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={payment.amount} />
              </td>
            </tr>
          ))}
          <tr className="bg-zinc-50 font-medium">
            <td className="px-3 py-2" colSpan={7}>
              Total payé
            </td>
            <td className="px-3 py-2 text-right">
              <Money value={total} />
            </td>
          </tr>
        </DocTable>
      )}
    </div>
  );
}
