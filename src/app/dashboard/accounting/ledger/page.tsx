import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocNumber,
  DocTable,
  Money,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listLedger } from "@/services/accounting.service";

export default async function LedgerPage() {
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

  const entries = await listLedger(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Grand livre"
        description="Toutes les écritures, les plus récentes d'abord. Le grand livre ne s'efface jamais \u2014 une annulation ajoute une ligne inverse."
      />
      {entries.length === 0 ? (
        <EmptyState
          title="Rien de comptabilisé"
          description="Les écritures apparaissent ici dès leur comptabilisation."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Date" },
            { label: "Pièce" },
            { label: "Compte" },
            { label: "Description" },
            { label: "Débit", align: "right" },
            { label: "Crédit", align: "right" },
          ]}
        >
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocDate iso={entry.postingDate} />
              </td>
              <td className="px-3 py-2">
                <DocNumber number={entry.voucherNumber} />
              </td>
              <td className="px-3 py-2">
                <span className="font-mono text-xs text-zinc-500">
                  {entry.accountCode}
                </span>
                <span className="ml-2 text-zinc-800">{entry.accountName}</span>
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {entry.description ?? "\u2014"}
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={entry.debit}
                  tone={entry.debit === 0 ? "muted" : undefined}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={entry.credit}
                  tone={entry.credit === 0 ? "muted" : undefined}
                />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
