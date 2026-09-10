import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/format";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listPurchaseInvoices } from "@/services/purchase-invoice.service";
import { listPurchaseOrders } from "@/services/purchase-order.service";
import { listPurchaseReceipts } from "@/services/purchase-receipt.service";
import { listSupplierGroups, listSuppliers } from "@/services/supplier.service";
import type { SupplierSummaryDTO } from "@/types/purchasing";

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) => (
  <div className="rounded-lg border bg-white p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
      {label}
    </p>
    <p
      className={`mt-1 text-2xl font-semibold ${
        tone === "danger" ? "text-red-600" : "text-zinc-900"
      }`}
    >
      {value}
    </p>
  </div>
);

const SupplierRow = ({ supplier }: { supplier: SupplierSummaryDTO }) => (
  <tr className="border-b last:border-0">
    <td className="px-3 py-2 font-mono text-xs text-zinc-500">
      {supplier.code}
    </td>
    <td className="px-3 py-2">
      <span className="font-medium text-zinc-900">{supplier.name}</span>
      {supplier.isBlocked && (
        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
          On hold
        </span>
      )}
      {supplier.disabled && (
        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
          Disabled
        </span>
      )}
    </td>
    <td className="px-3 py-2 text-zinc-600">
      {supplier.supplierGroupName ?? "—"}
    </td>
    <td className="px-3 py-2 text-zinc-600">{supplier.phone ?? "—"}</td>
    <td className="px-3 py-2 text-right tabular-nums">
      {supplier.openOrderCount}
    </td>
    <td className="px-3 py-2 text-right tabular-nums">
      {formatCurrency(supplier.outstandingAmount)}
    </td>
    <td
      className={`px-3 py-2 text-right tabular-nums ${
        supplier.overdueAmount > 0 ? "font-semibold text-red-600" : "text-zinc-400"
      }`}
    >
      {formatCurrency(supplier.overdueAmount)}
    </td>
  </tr>
);

export default async function PurchasingPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Purchasing"
          description="Suppliers, orders, receipts and supplier bills."
        />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant, then come back to set up purchasing."
        />
      </div>
    );
  }

  const [suppliers, groups, orders, receipts, invoices] = await Promise.all([
    listSuppliers(ctx, { includeDisabled: true }),
    listSupplierGroups(ctx),
    listPurchaseOrders(ctx),
    listPurchaseReceipts(ctx),
    listPurchaseInvoices(ctx),
  ]);

  const outstanding = suppliers.reduce((s, x) => s + x.outstandingAmount, 0);
  const overdue = suppliers.reduce((s, x) => s + x.overdueAmount, 0);
  const openOrders = orders.filter((order) => !["DRAFT", "COMPLETED", "CLOSED", "CANCELLED"].includes(order.status)).length;
  const toBill = receipts.filter((receipt) => ["TO_BILL", "PARTLY_BILLED"].includes(receipt.status)).length;
  const openInvoices = invoices.filter((invoice) => ["UNPAID", "PARTLY_PAID", "OVERDUE"].includes(invoice.status)).length;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Purchasing"
        description="Suppliers, purchase orders, goods receipts and supplier bills."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Suppliers" value={String(suppliers.length)} />
        <Stat label="Open orders" value={String(openOrders)} />
        <Stat label="Receipts to bill" value={String(toBill)} />
        <Stat
          label="Overdue payable"
          value={formatCurrency(overdue)}
          tone={overdue > 0 ? "danger" : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Supplier groups" value={String(groups.length)} />
        <Stat label="Open supplier bills" value={String(openInvoices)} />
        <Stat label="Total payable" value={formatCurrency(outstanding)} />
      </div>

      {suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          description="Add the vendors you buy from to start raising purchase orders."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Supplier</th>
                <th className="px-3 py-2 font-medium">Group</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 text-right font-medium">Open POs</th>
                <th className="px-3 py-2 text-right font-medium">
                  Outstanding
                </th>
                <th className="px-3 py-2 text-right font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <SupplierRow key={supplier.id} supplier={supplier} />
              ))}
            </tbody>
            <tfoot className="border-t bg-zinc-50 font-medium">
              <tr>
                <td className="px-3 py-2" colSpan={5}>
                  Total payable
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(outstanding)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600">
                  {formatCurrency(overdue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
