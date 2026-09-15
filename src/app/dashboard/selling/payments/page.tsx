import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocNumber,
  DocTable,
  Money,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listCustomerPayments } from "@/services/sales.document.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
export default async function CustomerPaymentsPage() {
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

  const rows = await listCustomerPayments(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Encaissements clients"
        description="L'argent reçu, et les factures réglées par chaque encaissement."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/selling/payments/new"
          label="Encaisser un client"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Encaissements"
        intro=""
        steps={[
          "« Encaisser un client » quand un client vous paie.",
          "« Settles » liste les factures réglées ; « On account » = argent reçu non encore affecté.",
        ]}
        tips={[]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucun encaissement"
          description="Enregistrez le paiement d'un client sur une facture ouverte."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Client" },
            { label: "Date" },
            { label: "Mode" },
            { label: "Référence" },
            { label: "Règle" },
            { label: "Acompte non affecté", align: "right" },
            { label: "Montant", align: "right" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={row.number} />
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {row.customerName}
              </td>
              <td className="px-3 py-2">
                <DocDate iso={row.paymentDate} />
              </td>
              <td className="px-3 py-2 text-zinc-600">{row.mode}</td>
              <td className="px-3 py-2 text-zinc-600">
                {row.referenceNo ?? "—"}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {row.allocations.length === 0
                  ? "On account"
                  : row.allocations.map((a) => a.invoiceNumber).join(", ")}
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={row.unallocatedAmount}
                  tone={row.unallocatedAmount === 0 ? "muted" : undefined}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={row.amount} />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
