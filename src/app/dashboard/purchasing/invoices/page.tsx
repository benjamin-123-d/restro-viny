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
import { listPurchaseInvoices } from "@/services/purchase-invoice.service";

export default async function PurchaseInvoicesPage() {
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

  const invoices = await listPurchaseInvoices(ctx);
  const payable = invoices.reduce((sum, i) => sum + i.outstandingAmount, 0);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Supplier bills"
        description="What you owe, and when it falls due."
      />
      {invoices.length === 0 ? (
        <EmptyState
          title="No supplier bills yet"
          description="Bill a goods receipt or a purchase order to open a payable."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Supplier ref" },
            { label: "Supplier" },
            { label: "Posted" },
            { label: "Due" },
            { label: "Status" },
            { label: "Total", align: "right" },
            { label: "Outstanding", align: "right" },
          ]}
        >
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={invoice.number} />
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {invoice.supplierInvoiceNo ?? "—"}
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {invoice.supplierName}
              </td>
              <td className="px-3 py-2">
                <DocDate iso={invoice.postingDate} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={invoice.dueDate} />
                {invoice.daysOverdue > 0 && (
                  <span className="ml-1 text-xs font-medium text-red-600">
                    +{invoice.daysOverdue}d
                  </span>
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
                  tone={
                    invoice.outstandingAmount === 0
                      ? "muted"
                      : invoice.daysOverdue > 0
                        ? "danger"
                        : undefined
                  }
                />
              </td>
            </tr>
          ))}
          <tr className="bg-zinc-50 font-medium">
            <td className="px-3 py-2" colSpan={7}>
              Total outstanding
            </td>
            <td className="px-3 py-2 text-right">
              <Money value={payable} />
            </td>
          </tr>
        </DocTable>
      )}
    </div>
  );
}
