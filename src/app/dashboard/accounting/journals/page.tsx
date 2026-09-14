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
import { listJournals } from "@/services/accounting.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
import {
  cancelJournalAction,
  deleteJournalAction,
  postJournalAction,
} from "@/actions/accounting.actions";
export default async function JournalsPage() {
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

  const journals = await listJournals(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Journals"
        description="Manual double-entry documents. Posting one writes it into the ledger; cancelling writes the mirror image rather than erasing it."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/accounting/journals/new"
          label="Nouvelle écriture"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Écritures comptables"
        intro=""
        steps={[
          "« + Nouvelle écriture » pour le loyer, les salaires, un apport…",
          "« Comptabiliser » l'inscrit au grand livre : elle apparaît alors dans la balance et le bilan.",
          "« Extourner » annule proprement en passant l'écriture inverse — rien n'est effacé.",
        ]}
        tips={[]}
      />
      {journals.length === 0 ? (
        <EmptyState
          title="No journals yet"
          description="Post a journal to open the books."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Number" },
            { label: "Date" },
            { label: "Status" },
            { label: "Reference" },
            { label: "Narration" },
            { label: "Lines", align: "right" },
            { label: "Amount", align: "right" },
            { label: "", align: "right" },
          ]}
        >
          {journals.map((journal) => (
            <tr key={journal.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={journal.number} />
              </td>
              <td className="px-3 py-2">
                <DocDate iso={journal.postingDate} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={journal.status} />
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {journal.reference ?? "\u2014"}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {journal.narration ?? "\u2014"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {journal.lines.length}
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={journal.totalDebit} />
              </td>
              <td className="px-3 py-2 text-right">
                <DocActions
                  id={journal.id}
                  actions={
                    journal.status === "DRAFT"
                      ? [
                          {
                            label: "Comptabiliser",
                            action: postJournalAction,
                            tone: "primary",
                            confirm:
                              "Comptabiliser ? L'écriture entrera au grand livre.",
                          },
                          {
                            label: "Supprimer",
                            action: deleteJournalAction,
                            tone: "danger",
                            confirm: "Supprimer ce brouillon ?",
                          },
                        ]
                      : journal.status === "POSTED"
                        ? [
                            {
                              label: "Extourner",
                              action: cancelJournalAction,
                              tone: "danger",
                              confirm:
                                "Extourner ? Une écriture inverse sera passée, l'originale reste visible.",
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
