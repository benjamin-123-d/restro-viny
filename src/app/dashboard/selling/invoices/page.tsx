import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocNumber,
  DocTable,
  Money,
  StatusBadge,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listSalesInvoices } from "@/services/sales.document.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
import {
  cancelSalesInvoiceAction,
  deleteSalesInvoiceAction,
  submitSalesInvoiceAction,
} from "@/actions/selling.actions";
export default async function SalesInvoicesPage() {
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

  const rows = await listSalesInvoices(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Factures clients"
        description="Ce que vos clients vous doivent, et quand."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/selling/invoices/new"
          label="Nouvelle facture"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Factures clients et duplicata"
        intro=""
        steps={[
          "« + Nouvelle facture » pour facturer un client.",
          "« Valider » la transforme en créance à encaisser.",
          "Cliquez un numéro de facture pour l'ouvrir et l'imprimer.",
          "En haut de la facture, choisissez Original, Duplicata (comptabilité) ou Triplicata (fisc).",
        ]}
        tips={["Encaissez le paiement depuis l'onglet « Receipts »."]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucune facture client"
          description="Facturez un bon de livraison ou une commande pour créer une créance."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Client" },
            { label: "Date" },
            { label: "Échéance" },
            { label: "Statut" },
            { label: "Total", align: "right" },
            { label: "Reste dû", align: "right" },
            { label: "", align: "right" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber
                  number={row.number}
                  href={`/dashboard/selling/invoices/${row.id}`}
                />
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {row.customerName}
              </td>
              <td className="px-3 py-2">
                <DocDate iso={row.postingDate} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={row.dueDate} />
                {row.daysOverdue > 0 && (
                  <span className="ml-1 text-xs font-medium text-red-600">
                    +{row.daysOverdue}d
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={row.grandTotal} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={row.outstandingAmount}
                  tone={
                    row.outstandingAmount === 0
                      ? "muted"
                      : row.daysOverdue > 0
                        ? "danger"
                        : undefined
                  }
                />
              </td>
              <td className="px-3 py-2 text-right">
                <DocActions
                  id={row.id}
                  actions={
                    row.status === "DRAFT"
                      ? [
                          {
                            label: "Valider",
                            action: submitSalesInvoiceAction,
                            tone: "primary",
                          },
                          {
                            label: "Supprimer",
                            action: deleteSalesInvoiceAction,
                            tone: "danger",
                            confirm: "Supprimer ce brouillon ?",
                          },
                        ]
                      : ["UNPAID", "OVERDUE"].includes(row.status)
                        ? [
                            {
                              label: "Annuler",
                              action: cancelSalesInvoiceAction,
                              tone: "danger",
                              confirm: "Annuler cette facture ?",
                            },
                          ]
                        : []
                  }
                />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
