import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocNumber,
  DocTable,
  StatusBadge,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listMaterialRequests } from "@/services/stock-advanced.service";

export default async function MaterialRequestsPage() {
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

  const rows = await listMaterialRequests(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Material requests"
        description="Internal asks for goods — to buy, to transfer, or to issue from store."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No material requests yet"
          description="Raise a request when the kitchen or bar needs stock."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Type" },
            { label: "Raised" },
            { label: "Needed by" },
            { label: "Status" },
            { label: "Items", align: "right" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={row.number} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.type} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={row.transactionDate} />
              </td>
              <td className="px-3 py-2">
                <span className={row.isLate ? "text-red-600" : ""}>
                  <DocDate iso={row.requiredBy} />
                </span>
                {row.isLate && (
                  <span className="ml-1 text-xs font-medium text-red-600">
                    late
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.itemCount}
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
