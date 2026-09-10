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
import { listStockEntries } from "@/services/stock-advanced.service";

export default async function StockEntriesPage() {
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

  const rows = await listStockEntries(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Stock entries"
        description="Receipts, issues and transfers between warehouses."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No stock entries yet"
          description="Post an entry to receive, issue or move stock between warehouses."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Purpose" },
            { label: "Posted" },
            { label: "Status" },
            { label: "Items", align: "right" },
            { label: "Value", align: "right" }
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2"><DocNumber number={row.number} /></td>
              <td className="px-3 py-2"><StatusBadge status={row.purpose} /></td>
              <td className="px-3 py-2"><DocDate iso={row.postingDate} /></td>
              <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-2 text-right tabular-nums">{row.itemCount}</td>
              <td className="px-3 py-2 text-right"><Money value={row.totalValue} /></td>
            </tr>
          ))}

        </DocTable>
      )}
    </div>
  );
}
