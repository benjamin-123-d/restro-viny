import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/format";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listCustomers } from "@/services/customer.service";
import {
  listDeliveryNotes,
  listSalesInvoices,
  listSalesOrders,
  listSalesQuotations,
} from "@/services/sales.document.service";

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

const LIVE_ORDER = ["TO_DELIVER_AND_BILL", "TO_DELIVER", "TO_BILL", "ON_HOLD"];
const OPEN_INVOICE = ["UNPAID", "PARTLY_PAID", "OVERDUE"];

export default async function SellingPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Selling"
          description="Customers, quotations, sales orders, deliveries and invoices."
        />
        <EmptyState
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant, then come back to set up selling."
        />
      </div>
    );
  }

  const [customers, quotations, orders, deliveries, invoices] =
    await Promise.all([
      listCustomers(ctx, { includeDisabled: true }),
      listSalesQuotations(ctx),
      listSalesOrders(ctx),
      listDeliveryNotes(ctx),
      listSalesInvoices(ctx),
    ]);

  const receivable = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
  const overdue = invoices
    .filter((i) => i.daysOverdue > 0)
    .reduce((s, i) => s + i.outstandingAmount, 0);
  const openOrders = orders.filter((o) => LIVE_ORDER.includes(o.status)).length;
  const openQuotes = quotations.filter((q) =>
    ["OPEN", "REPLIED"].includes(q.status),
  ).length;
  const toBill = deliveries.filter((d) =>
    ["TO_BILL", "PARTLY_BILLED"].includes(d.status),
  ).length;
  const openInvoices = invoices.filter((i) =>
    OPEN_INVOICE.includes(i.status),
  ).length;
  const overLimit = customers.filter((c) => c.overCreditLimit).length;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Selling"
        description="Customers, quotations, sales orders, deliveries, invoices and receipts."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Customers" value={String(customers.length)} />
        <Stat label="Open quotations" value={String(openQuotes)} />
        <Stat label="Open sales orders" value={String(openOrders)} />
        <Stat
          label="Overdue receivable"
          value={formatCurrency(overdue)}
          tone={overdue > 0 ? "danger" : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Deliveries to bill" value={String(toBill)} />
        <Stat label="Open invoices" value={String(openInvoices)} />
        <Stat label="Total receivable" value={formatCurrency(receivable)} />
        <Stat
          label="Over credit limit"
          value={String(overLimit)}
          tone={overLimit > 0 ? "danger" : undefined}
        />
      </div>

      {customers.length === 0 && (
        <EmptyState
          title="No customers yet"
          description="Add the accounts you invoice to start the sales chain."
        />
      )}
    </div>
  );
}
