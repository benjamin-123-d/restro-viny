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
import { listPurchaseReceipts } from "@/services/purchase-receipt.service";

export default async function PurchaseReceiptsPage() {
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

  const receipts = await listPurchaseReceipts(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Goods receipts"
        description="Deliveries booked in. Submitting a receipt is what moves stock — it writes straight to the inventory ledger."
      />
      {receipts.length === 0 ? (
        <EmptyState
          title="Nothing received yet"
          description="Book in a delivery against a purchase order to add it to stock."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Supplier" },
            { label: "Posted" },
            { label: "Status" },
            { label: "Billed" },
            { label: "Total", align: "right" },
          ]}
        >
          {receipts.map((receipt) => (
            <tr key={receipt.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={receipt.number} />
                {receipt.isReturn && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                    return
                  </span>
                )}
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {receipt.supplierName}
              </td>
              <td className="px-3 py-2">
                <DocDate iso={receipt.postingDate} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={receipt.status} />
              </td>
              <td className="px-3 py-2">
                <Progress percent={receipt.billedPercent} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={receipt.grandTotal} />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
