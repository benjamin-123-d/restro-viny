import { PaperclipIcon } from "lucide-react";

import {
  cancelPurchaseInvoiceAction,
  deletePurchaseInvoiceAction,
  submitPurchaseInvoiceAction,
} from "@/actions/purchasing.actions";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
import { HelpBox } from "@/components/forms/help-box";
import {
  DocDate,
  DocNumber,
  DocTable,
  Money,
  StatusBadge,
} from "@/components/purchasing/purchasing-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listPurchaseInvoices } from "@/services/purchase-invoice.service";

export const metadata = { title: "Factures fournisseurs" };

export default async function PurchaseInvoicesPage() {
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

  const invoices = await listPurchaseInvoices(ctx);
  const payable = invoices.reduce((sum, i) => sum + i.outstandingAmount, 0);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Factures fournisseurs"
          description="Ce que vous devez à vos fournisseurs, et quand."
        />
        <NewButton href="/dashboard/purchasing/invoices/new" label="Importer une facture" />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Factures fournisseurs"
        steps={[
          "« Importer une facture » : le PDF ou une photo de la facture, puis juste le total.",
          "« Valider » la transforme en dette ; « Reste à payer » montre ce qui reste dû.",
          "Payez-la depuis l'onglet « Paiements ».",
        ]}
        tips={["« +12 j » à côté de l'échéance = en retard de 12 jours.", "Le trombone indique qu'un document est attaché."]}
      />
      {invoices.length === 0 ? (
        <EmptyState
          title="Aucune facture fournisseur"
          description="Importez la facture reçue d'un fournisseur, ou facturez une réception de marchandises."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Réf. fournisseur" },
            { label: "Fournisseur" },
            { label: "Date" },
            { label: "Échéance" },
            { label: "Statut" },
            { label: "Total TTC", align: "right" },
            { label: "Reste à payer", align: "right" },
            { label: "", align: "right" },
          ]}
        >
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <DocNumber number={invoice.number} href={`/dashboard/purchasing/invoices/${invoice.id}`} />
                  {invoice.documentCount > 0 ? (
                    <PaperclipIcon className="size-3.5 text-muted-foreground" aria-label="Document attaché" />
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{invoice.supplierInvoiceNo ?? "—"}</td>
              <td className="px-3 py-2 font-medium">{invoice.supplierName}</td>
              <td className="px-3 py-2">
                <DocDate iso={invoice.postingDate} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={invoice.dueDate} />
                {invoice.daysOverdue > 0 && (
                  <span className="ml-1 text-xs font-medium text-red-600">+{invoice.daysOverdue} j</span>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={invoice.status} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={invoice.grandTotal} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={invoice.outstandingAmount}
                  tone={invoice.outstandingAmount === 0 ? "muted" : invoice.daysOverdue > 0 ? "danger" : undefined}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <DocActions
                  id={invoice.id}
                  actions={
                    invoice.status === "DRAFT"
                      ? [
                          { label: "Valider", action: submitPurchaseInvoiceAction, tone: "primary" },
                          { label: "Supprimer", action: deletePurchaseInvoiceAction, tone: "danger", confirm: "Supprimer ce brouillon ?" },
                        ]
                      : ["UNPAID", "OVERDUE"].includes(invoice.status)
                        ? [
                            {
                              label: "Annuler",
                              action: cancelPurchaseInvoiceAction,
                              tone: "danger",
                              confirm: "Annuler cette facture ? Ses effets seront inversés.",
                            },
                          ]
                        : []
                  }
                />
              </td>
            </tr>
          ))}
          <tr className="bg-muted/40 font-medium">
            <td className="px-3 py-2" colSpan={7}>
              Total restant à payer
            </td>
            <td className="px-3 py-2 text-right">
              <Money value={payable} />
            </td>
            <td />
          </tr>
        </DocTable>
      )}
    </div>
  );
}
