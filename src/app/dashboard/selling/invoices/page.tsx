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

export default async function SalesInvoicesPage() {
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

  const rows = await listSalesInvoices(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Sales invoices"
        description="What customers owe you, and when it falls due."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No sales invoices yet"
          description="Bill a delivery note or a sales order to open a receivable."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Customer" },
            { label: "Posted" },
            { label: "Due" },
            { label: "Status" },
            { label: "Total", align: "right" },
            { label: "Outstanding", align: "right" }
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
              <td className="px-3 py-2 font-medium text-zinc-900">{row.customerName}</td>
              <td className="px-3 py-2"><DocDate iso={row.postingDate} /></td>
              <td className="px-3 py-2">
                <DocDate iso={row.dueDate} />
                {row.daysOverdue > 0 && (
                  <span className="ml-1 text-xs font-medium text-red-600">+{row.daysOverdue}d</span>
                )}
              </td>
              <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-2 text-right"><Money value={row.grandTotal} /></td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={row.outstandingAmount}
                  tone={row.outstandingAmount === 0 ? "muted" : row.daysOverdue > 0 ? "danger" : undefined}
                />
              </td>
            </tr>
          ))}

        </DocTable>
      )}
    </div>
  );
}
