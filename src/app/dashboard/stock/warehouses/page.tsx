import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { DocTable, Money } from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listWarehouses } from "@/services/stock-advanced.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
export default async function WarehousesPage() {
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

  const rows = await listWarehouses(ctx, { includeDisabled: true });

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Entrepôts"
        description="Où se trouve physiquement le stock : réserve, chambre froide, bar, second établissement."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/stock/warehouses/new"
          label="Nouvel entrepôt"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Entrepôts"
        intro=""
        steps={[
          "« + Nouvel entrepôt » pour chaque lieu de stockage réel.",
          "« Items » = nombre d'articles présents ; « Stock value » = leur valeur.",
          "Voyez le détail par article dans l'onglet « Stock by warehouse ».",
        ]}
        tips={[]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucun entrepôt"
          description="Créez un entrepôt pour suivre le stock par emplacement."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Nom" },
            { label: "Code" },
            { label: "Parent" },
            { label: "Ville" },
            { label: "Articles", align: "right" },
            { label: "Valeur du stock", align: "right" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <span className="font-medium text-zinc-900">{row.name}</span>
                {row.isGroup && (
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    group
                  </span>
                )}
                {row.isDefault && (
                  <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                    default
                  </span>
                )}
                {row.disabled && (
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    disabled
                  </span>
                )}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                {row.code ?? "—"}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {row.parentName ?? "—"}
              </td>
              <td className="px-3 py-2 text-zinc-600">{row.city ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.itemCount}
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
