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
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant."
        />
      </div>
    );
  }

  const rows = await listStockReconciliations(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Comptages de stock"
        description="Les comptages physiques et la valeur de ce qu'ils ont corrigé."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucun comptage"
          description="Faites un comptage pour aligner le système sur les étagères."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Date" },
            { label: "Statut" },
            { label: "Articles", align: "right" },
            { label: "Écart", align: "right" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={row.number} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={row.postingDate} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.itemCount}
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={row.differenceValue}
                  tone={row.differenceValue < 0 ? "danger" : undefined}
                />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
