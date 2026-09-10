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
          ]}
        >
          {orders.map((order) => (
            <tr key={order.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber
                  number={order.number}
                  href={`/dashboard/purchasing/orders/${order.id}`}
                />
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
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
