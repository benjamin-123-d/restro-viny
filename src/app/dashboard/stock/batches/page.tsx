import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { DocDate, DocTable } from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listBatches } from "@/services/stock-advanced.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
export default async function BatchesPage() {
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

  const rows = await listBatches(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Lots et dates limites"
        description="Les lots suivis et ceux qui arrivent à date limite."
      />
      <HelpBox
        defaultOpen={false}
        title="Aide — Lots et péremption"
        intro=""
        steps={[
          "Chaque lot porte un numéro et une date de péremption.",
          "« Days left » en orange = moins de 7 jours ; « expired » en rouge = à retirer.",
          "Utilisez d'abord les lots qui périment le plus tôt.",
        ]}
        tips={[]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucun lot suivi"
          description="Enregistrez un lot à la réception de produits périssables."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Lot" },
            { label: "Article" },
            { label: "Entrepôt" },
            { label: "Fabriqué le" },
            { label: "Expire le" },
            { label: "Jours restants", align: "right" },
            { label: "Quantité", align: "right" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono text-xs font-medium text-zinc-900">
                {row.batchNo}
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {row.stockItemName}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {row.warehouseName ?? "—"}
              </td>
              <td className="px-3 py-2">
                <DocDate iso={row.manufactureDate} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={row.expiryDate} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.daysToExpiry === null ? (
                  <span className="text-zinc-400">—</span>
                ) : row.isExpired ? (
                  <span className="font-semibold text-red-600">expired</span>
                ) : (
                  <span
                    className={
                      row.daysToExpiry <= 7
                        ? "font-semibold text-amber-700"
                        : ""
                    }
                  >
                    {row.daysToExpiry}d
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.quantity} {row.unit}
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
