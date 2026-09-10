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

export default async function SalesQuotationsPage() {
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

  const rows = await listSalesQuotations(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Quotations"
        description="Prices offered to customers, and whether they turned into orders."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No quotations yet"
          description="Quote a customer to start the sales chain."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Customer" },
            { label: "Date" },
            { label: "Valid until" },
            { label: "Status" },
            { label: "Total", align: "right" }
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2"><DocNumber number={row.number} /></td>
              <td className="px-3 py-2 font-medium text-zinc-900">{row.customerName}</td>
              <td className="px-3 py-2"><DocDate iso={row.transactionDate} /></td>
              <td className="px-3 py-2">
                <DocDate iso={row.validUntil} />
                {row.isExpired && (
                  <span className="ml-1 text-xs font-medium text-red-600">expired</span>
                )}
              </td>
              <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-2 text-right"><Money value={row.grandTotal} /></td>
            </tr>
          ))}

        </DocTable>
      )}
    </div>
  );
}
