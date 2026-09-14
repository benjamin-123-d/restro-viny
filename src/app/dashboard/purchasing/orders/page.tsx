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
import { listPurchaseOrders } from "@/services/purchase-order.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
import {
  closePurchaseOrderAction,
  deletePurchaseOrderAction,
  submitPurchaseOrderAction,
} from "@/actions/purchasing.actions";
export default async function PurchaseOrdersPage() {
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

  const orders = await listPurchaseOrders(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Purchase orders"
        description="What you have committed to buy, and how much of it has arrived and been billed."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/purchasing/orders/new"
          label="Nouvelle commande"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Commandes d'achat"
        intro=""
        steps={[
          "« + Nouvelle commande » pour commander à un fournisseur.",
          "Une commande naît en « Draft » (brouillon) : cliquez « Valider » quand elle est prête.",
          "Les barres « Received » et « Billed » montrent l'avancement : reçu, puis facturé.",
          "« Clôturer » arrête une commande qui ne sera jamais complète (fournisseur en rupture…).",
        ]}
        tips={["Une date de livraison dépassée affiche « late » en rouge."]}
      />
      {orders.length === 0 ? (
        <EmptyState
          title="No purchase orders yet"
          description="Raise an order against a supplier to start tracking deliveries."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Supplier" },
            { label: "Date" },
            { label: "Expected" },
            { label: "Status" },
            { label: "Received" },
            { label: "Billed" },
            { label: "Total", align: "right" },
            { label: "", align: "right" },
          ]}
        >
          {orders.map((order) => (
            <tr key={order.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={order.number} />
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {order.supplierName}
              </td>
              <td className="px-3 py-2">
                <DocDate iso={order.transactionDate} />
              </td>
              <td className="px-3 py-2">
                <span className={order.isLate ? "text-red-600" : ""}>
                  <DocDate iso={order.scheduleDate} />
                </span>
                {order.isLate && (
                  <span className="ml-1 text-xs font-medium text-red-600">
                    late
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={order.status} />
              </td>
              <td className="px-3 py-2">
                <Progress percent={order.receivedPercent} />
              </td>
              <td className="px-3 py-2">
                <Progress percent={order.billedPercent} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={order.grandTotal} />
              </td>
              <td className="px-3 py-2 text-right">
                <DocActions
                  id={order.id}
                  actions={
                    order.status === "DRAFT"
                      ? [
                          {
                            label: "Valider",
                            action: submitPurchaseOrderAction,
                            tone: "primary",
                          },
                          {
                            label: "Supprimer",
                            action: deletePurchaseOrderAction,
                            tone: "danger",
                            confirm: "Supprimer ce brouillon ?",
                          },
                        ]
                      : [
                            "TO_RECEIVE_AND_BILL",
                            "TO_RECEIVE",
                            "TO_BILL",
                          ].includes(order.status)
                        ? [
                            {
                              label: "Clôturer",
                              action: closePurchaseOrderAction,
                              confirm:
                                "Clôturer cette commande ? Ce qui est déjà reçu reste acquis.",
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
