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
import { listSalesQuotations } from "@/services/sales.document.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
import {
  deleteSalesQuotationAction,
  submitSalesQuotationAction,
} from "@/actions/selling.actions";
export default async function SalesQuotationsPage() {
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

  const rows = await listSalesQuotations(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Devis"
        description="Les prix proposés aux clients, et ceux qui sont devenus des commandes."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/selling/quotations/new"
          label="Nouveau devis"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Devis"
        intro=""
        steps={[
          "« + Nouveau devis » pour proposer un prix à un client.",
          "« Envoyer » passe le devis de brouillon à « Open » (en attente de réponse).",
          "« Lost » = refusé ; « Ordered » = transformé en commande.",
        ]}
        tips={[]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucun devis"
          description="Établissez un devis pour démarrer le cycle de vente."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Client" },
            { label: "Date" },
            { label: "Valable jusqu'au" },
            { label: "Statut" },
            { label: "Total", align: "right" },
            { label: "", align: "right" },
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
                <DocDate iso={row.transactionDate} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={row.validUntil} />
                {row.isExpired && (
                  <span className="ml-1 text-xs font-medium text-red-600">
                    expired
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
                <DocActions
                  id={row.id}
                  actions={
                    row.status === "DRAFT"
                      ? [
                          {
                            label: "Envoyer",
                            action: submitSalesQuotationAction,
                            tone: "primary",
                          },
                          {
                            label: "Supprimer",
                            action: deleteSalesQuotationAction,
                            tone: "danger",
                            confirm: "Supprimer ce brouillon ?",
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
