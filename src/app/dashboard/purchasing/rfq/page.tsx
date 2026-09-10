import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocNumber,
  DocTable,
  StatusBadge,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listRfqs } from "@/services/rfq.service";

export default async function RfqPage() {
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

  const rfqs = await listRfqs(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Requests for quotation"
        description="Ask several suppliers to price the same basket, then compare their answers line by line."
      />
      {rfqs.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="Send the same list to two or three suppliers to see who is cheapest."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Raised" },
            { label: "Needed by" },
            { label: "Status" },
            { label: "Items", align: "right" },
            { label: "Suppliers", align: "right" },
            { label: "Quotes in", align: "right" },
          ]}
        >
          {rfqs.map((rfq) => (
            <tr key={rfq.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber
                  number={rfq.number}
                  href={`/dashboard/purchasing/rfq/${rfq.id}`}
                />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={rfq.transactionDate} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={rfq.requiredBy} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={rfq.status} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {rfq.itemCount}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {rfq.supplierCount}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span
                  className={
                    rfq.quotationCount === 0 ? "text-zinc-400" : "font-medium"
                  }
                >
                  {rfq.quotationCount} / {rfq.supplierCount}
                </span>
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
