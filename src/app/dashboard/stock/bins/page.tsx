import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { DocTable, Money } from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listBins } from "@/services/stock-advanced.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
export default async function BinsPage() {
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

  const rows = await listBins(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Stock par entrepôt"
        description="Le stock de chaque article dans chaque entrepôt. Prévisionnel = réel + commandé − réservé."
      />
      <HelpBox
        defaultOpen={false}
        title="Aide — Stock par entrepôt"
        intro="Chaque ligne = un article dans un entrepôt."
        steps={[
          "« Actual » = ce qui est physiquement sur l'étagère.",
          "« Ordered » = commandé, pas encore reçu. « Reserved » = promis à un client.",
          "« Projected » = Actual + Ordered − Reserved : ce sur quoi compter pour décider de recommander.",
        ]}
        tips={[]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Rien en stock pour l'instant"
          description="Réceptionnez des marchandises ou validez un mouvement pour remplir un entrepôt."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Entrepôt" },
            { label: "Article" },
            { label: "Réel", align: "right" },
            { label: "Réservé", align: "right" },
            { label: "Commandé", align: "right" },
            { label: "Prévisionnel", align: "right" },
            { label: "Prix", align: "right" },
            { label: "Valeur", align: "right" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2 text-zinc-600">{row.warehouseName}</td>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {row.stockItemName}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.actualQty} {row.unit}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                {row.reservedQty}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                {row.orderedQty}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {row.projectedQty}
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={row.valuationRate} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={row.stockValue} />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
