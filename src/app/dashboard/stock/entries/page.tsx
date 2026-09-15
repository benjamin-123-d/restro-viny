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

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
import {
  cancelStockEntryAction,
  deleteStockEntryAction,
  submitStockEntryAction,
} from "@/actions/stock-advanced.actions";
export default async function StockEntriesPage() {
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

  const rows = await listStockEntries(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Mouvements de stock"
        description="Entrées, sorties et transferts entre entrepôts."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/stock/entries/new"
          label="Nouvelle écriture de stock"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Écritures de stock"
        intro=""
        steps={[
          "« + Nouvelle écriture de stock » pour une entrée, une sortie ou un transfert.",
          "Le stock ne bouge qu'au clic sur « Valider ».",
          "« Annuler » remet le stock exactement où il était.",
        ]}
        tips={[]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucun mouvement de stock"
          description="Validez un mouvement pour entrer, sortir ou transférer du stock."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Objet" },
            { label: "Date" },
            { label: "Statut" },
            { label: "Articles", align: "right" },
            { label: "Valeur", align: "right" },
            { label: "", align: "right" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={row.number} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.purpose} />
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
                <Money value={row.totalValue} />
              </td>
              <td className="px-3 py-2 text-right">
                <DocActions
                  id={row.id}
                  actions={
                    row.status === "DRAFT"
                      ? [
                          {
                            label: "Valider",
                            action: submitStockEntryAction,
                            tone: "primary",
                          },
                          {
                            label: "Supprimer",
                            action: deleteStockEntryAction,
                            tone: "danger",
                            confirm: "Supprimer ce brouillon ?",
                          },
                        ]
                      : row.status === "SUBMITTED"
                        ? [
                            {
                              label: "Annuler",
                              action: cancelStockEntryAction,
                              tone: "danger",
                              confirm:
                                "Annuler ? Le stock sera remis où il était.",
                            },
                          ]
                        : []
                  }
                />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
