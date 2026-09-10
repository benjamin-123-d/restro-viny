import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocTable,
  Money,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listCustomers } from "@/services/customer.service";

export default async function CustomersPage() {
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

  const rows = await listCustomers(ctx, { includeDisabled: true });

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Customers"
        description="Account customers, what they owe, and how much credit they have left."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add the accounts you invoice to start raising sales orders."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Code" },
            { label: "Customer" },
            { label: "Group" },
            { label: "Phone" },
            { label: "Open SOs", align: "right" },
            { label: "Outstanding", align: "right" },
            { label: "Credit left", align: "right" },
            { label: "Overdue", align: "right" }
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono text-xs text-zinc-500">{row.code}</td>
              <td className="px-3 py-2">
                <span className="font-medium text-zinc-900">{row.name}</span>
                {row.overCreditLimit && (
                  <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                    over limit
                  </span>
                )}
                {row.disabled && (
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    disabled
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-zinc-600">{row.customerGroupName ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-600">{row.phone ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.openOrderCount}</td>
              <td className="px-3 py-2 text-right">
                <Money value={row.outstandingAmount} tone={row.outstandingAmount === 0 ? "muted" : undefined} />
              </td>
              <td className="px-3 py-2 text-right">
                {row.creditAvailable === null ? (
                  <span className="text-zinc-400">no limit</span>
                ) : (
                  <Money value={row.creditAvailable} tone={row.creditAvailable < 0 ? "danger" : undefined} />
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={row.overdueAmount} tone={row.overdueAmount > 0 ? "danger" : "muted"} />
              </td>
            </tr>
          ))}

        </DocTable>
      )}
    </div>
  );
}
