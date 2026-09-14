import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocNumber,
  DocTable,
  Money,
  Progress,
  StatusBadge,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listSalesOrders } from "@/services/sales.document.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
import {
  closeSalesOrderAction,
  deleteSalesOrderAction,
  submitSalesOrderAction,
} from "@/actions/selling.actions";
export default async function SalesOrdersPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant."
        />
      </div>
    );
  }

  const rows = await listSalesOrders(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Sales orders"
        description="What customers have committed to buy, and how much has shipped and been billed."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/selling/orders/new"
          label="Nouvelle commande client"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Commandes clients"
        intro=""
        steps={[
          "« + Nouvelle commande client » pour enregistrer l'engagement d'un client.",
          "« Valider » la rend active ; « Delivered » et « Billed » suivent la livraison et la facturation.",
          "« late » en rouge = date de livraison dépassée.",
        ]}
        tips={[]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No sales orders yet"
          description="Confirm a quotation or raise an order directly."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Customer" },
            { label: "Date" },
            { label: "Deliver by" },
            { label: "Status" },
            { label: "Delivered" },
            { label: "Billed" },
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
                <span className={row.isLate ? "text-red-600" : ""}>
                  <DocDate iso={row.deliveryDate} />
                </span>
                {row.isLate && (
                  <span className="ml-1 text-xs font-medium text-red-600">
                    late
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2">
                <Progress percent={row.deliveredPercent} />
              </td>
              <td className="px-3 py-2">
                <Progress percent={row.billedPercent} />
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
                            label: "Valider",
                            action: submitSalesOrderAction,
                            tone: "primary",
                          },
                          {
                            label: "Supprimer",
                            action: deleteSalesOrderAction,
                            tone: "danger",
                            confirm: "Supprimer ce brouillon ?",
                          },
                        ]
                      : [
                            "TO_DELIVER_AND_BILL",
                            "TO_DELIVER",
                            "TO_BILL",
                          ].includes(row.status)
                        ? [
                            {
                              label: "Clôturer",
                              action: closeSalesOrderAction,
                              confirm: "Clôturer cette commande ?",
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
