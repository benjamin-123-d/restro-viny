import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocTable,
  Money,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listBins } from "@/services/stock-advanced.service";

export default async function BinsPage() {
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

  const rows = await listBins(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Stock by warehouse"
        description="What each item holds in each warehouse. Projected is actual plus ordered, less reserved."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Nothing in stock yet"
          description="Receive goods or post a stock entry to fill a warehouse."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Warehouse" },
            { label: "Item" },
            { label: "Actual", align: "right" },
            { label: "Reserved", align: "right" },
            { label: "Ordered", align: "right" },
            { label: "Projected", align: "right" },
            { label: "Rate", align: "right" },
            { label: "Value", align: "right" }
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2 text-zinc-600">{row.warehouseName}</td>
              <td className="px-3 py-2 font-medium text-zinc-900">{row.stockItemName}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.actualQty} {row.unit}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{row.reservedQty}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{row.orderedQty}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{row.projectedQty}</td>
              <td className="px-3 py-2 text-right"><Money value={row.valuationRate} /></td>
              <td className="px-3 py-2 text-right"><Money value={row.stockValue} /></td>
            </tr>
          ))}

        </DocTable>
      )}
    </div>
  );
}
