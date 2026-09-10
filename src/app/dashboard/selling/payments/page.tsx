import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocNumber,
  DocTable,
  Money,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listCustomerPayments } from "@/services/sales.document.service";

export default async function CustomerPaymentsPage() {
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

  const rows = await listCustomerPayments(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Customer receipts"
        description="Money received, and which invoices each receipt settled."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No receipts yet"
          description="Record a customer payment against an open invoice."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Customer" },
            { label: "Date" },
            { label: "Mode" },
            { label: "Reference" },
            { label: "Settles" },
            { label: "On account", align: "right" },
            { label: "Amount", align: "right" }
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2"><DocNumber number={row.number} /></td>
              <td className="px-3 py-2 font-medium text-zinc-900">{row.customerName}</td>
              <td className="px-3 py-2"><DocDate iso={row.paymentDate} /></td>
              <td className="px-3 py-2 text-zinc-600">{row.mode}</td>
              <td className="px-3 py-2 text-zinc-600">{row.referenceNo ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-600">
                {row.allocations.length === 0
                  ? "On account"
                  : row.allocations.map((a) => a.invoiceNumber).join(", ")}
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={row.unallocatedAmount} tone={row.unallocatedAmount === 0 ? "muted" : undefined} />
              </td>
              <td className="px-3 py-2 text-right"><Money value={row.amount} /></td>
            </tr>
          ))}

        </DocTable>
      )}
    </div>
  );
}
