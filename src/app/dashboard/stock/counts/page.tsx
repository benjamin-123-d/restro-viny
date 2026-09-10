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
import { listStockReconciliations } from "@/services/stock-advanced.service";

export default async function StockCountsPage() {
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

  const rows = await listStockReconciliations(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Stock counts"
        description="Physical counts and the value of what they corrected."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No counts yet"
          description="Run a count to bring the system back in line with the shelf."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Posted" },
            { label: "Status" },
            { label: "Items", align: "right" },
            { label: "Difference", align: "right" }
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2"><DocNumber number={row.number} /></td>
              <td className="px-3 py-2"><DocDate iso={row.postingDate} /></td>
              <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-2 text-right tabular-nums">{row.itemCount}</td>
              <td className="px-3 py-2 text-right">
                <Money value={row.differenceValue} tone={row.differenceValue < 0 ? "danger" : undefined} />
              </td>
            </tr>
          ))}

        </DocTable>
      )}
    </div>
  );
}
