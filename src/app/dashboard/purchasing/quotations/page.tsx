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
import { listSupplierQuotations } from "@/services/rfq.service";

export default async function SupplierQuotationsPage() {
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

  const quotations = await listSupplierQuotations(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Supplier quotations"
        description="Prices suppliers have offered. Accept one to turn it straight into a purchase order."
      />
      {quotations.length === 0 ? (
        <EmptyState
          title="No quotations yet"
          description="Record what a supplier quoted, or raise an RFQ to collect several at once."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Supplier" },
            { label: "Date" },
            { label: "Valid until" },
            { label: "Status" },
            { label: "Total", align: "right" },
          ]}
        >
          {quotations.map((quotation) => (
            <tr key={quotation.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={quotation.number} />
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {quotation.supplierName}
              </td>
              <td className="px-3 py-2">
                <DocDate iso={quotation.transactionDate} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={quotation.validUntil} />
                {quotation.isExpired && (
                  <span className="ml-1 text-xs font-medium text-red-600">
                    expired
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={quotation.status} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={quotation.grandTotal} />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
