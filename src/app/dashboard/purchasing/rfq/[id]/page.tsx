import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocTable,
  Money,
  StatusBadge,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { compareQuotations, getRfq } from "@/services/rfq.service";

/**
 * The point of an RFQ: every supplier's price for the same line, side by side,
 * with the cheapest already marked so no one has to do the arithmetic.
 */
export default async function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) notFound();

  const { id } = await params;

  const rfq = await getRfq(ctx, id).catch(() => null);
  if (!rfq) notFound();

  const comparison = await compareQuotations(ctx, id);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title={rfq.number}
        description="Quotation comparison — the best price on each line is highlighted."
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge status={rfq.status} />
        <span className="text-zinc-600">
          Raised <DocDate iso={rfq.transactionDate} />
        </span>
        {rfq.requiredBy && (
          <span className="text-zinc-600">
            Needed by <DocDate iso={rfq.requiredBy} />
          </span>
        )}
        <span className="text-zinc-600">
          {rfq.quotationCount} of {rfq.suppliers.length} suppliers replied
        </span>
      </div>

      {comparison.suppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-zinc-500">
          No quotations have come back yet. Once suppliers reply, their prices
          appear here side by side.
        </div>
      ) : (
        <DocTable
          headers={[
            { label: "Item" },
            { label: "Qty", align: "right" },
            ...comparison.suppliers.map((s) => ({
              label: s.supplierName,
              align: "right" as const,
            })),
          ]}
        >
          {comparison.rows.map((row) => (
            <tr key={row.rfqItemId} className="border-b last:border-0">
              <td className="px-3 py-2 font-medium text-zinc-900">
                {row.stockItemName}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                {row.quantity} {row.unit}
              </td>
              {comparison.suppliers.map((supplier) => {
                const cell = row.cells[supplier.supplierId];
                return (
                  <td
                    key={supplier.supplierId}
                    className={`px-3 py-2 text-right ${
                      cell?.isBest ? "bg-green-50" : ""
                    }`}
                  >
                    {cell ? (
                      <>
                        <span
                          className={
                            cell.isBest ? "font-semibold text-green-700" : ""
                          }
                        >
                          <Money value={cell.rate} />
                        </span>
                        {cell.leadTimeDays !== null && (
                          <span className="ml-1 text-xs text-zinc-400">
                            {cell.leadTimeDays}d
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="bg-zinc-50 font-medium">
            <td className="px-3 py-2" colSpan={2}>
              Quotation total
            </td>
            {comparison.suppliers.map((supplier) => (
              <td key={supplier.supplierId} className="px-3 py-2 text-right">
                <Money value={supplier.grandTotal} />
              </td>
            ))}
          </tr>
        </DocTable>
      )}
    </div>
  );
}
