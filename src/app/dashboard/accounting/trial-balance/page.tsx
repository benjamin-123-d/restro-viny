import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { DocTable, Money } from "@/components/purchasing/purchasing-ui";
import { ROOT_TYPE_LABEL } from "@/lib/accounting";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getTrialBalance } from "@/services/accounting.service";

export default async function TrialBalancePage() {
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

  const tb = await getTrialBalance(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Solde"
        description="Chaque compte mouvementé, et la preuve que débit et crédit concordent."
      />
      {tb.rows.length === 0 ? (
        <EmptyState
          title="Rien de comptabilisé"
          description="La balance se remplit dès qu'une écriture est comptabilisée."
        />
      ) : (
        <>
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              tb.isBalanced
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-700"
            }`}
          >
            {tb.isBalanced
              ? "Les débits et les crédits concordent."
              : "Déséquilibre \u2014 le grand livre ne tombe pas juste."}
          </p>
          <DocTable
            headers={[
              { label: "Code" },
              { label: "Compte" },
              { label: "Type" },
              { label: "Débit", align: "right" },
              { label: "Crédit", align: "right" },
            ]}
          >
            {tb.rows.map((row) => (
              <tr key={row.accountId} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                  {row.code}
                </td>
                <td className="px-3 py-2 font-medium text-zinc-900">
                  {row.name}
                </td>
                <td className="px-3 py-2 text-zinc-600">
                  {ROOT_TYPE_LABEL[row.rootType]}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money
                    value={row.debit}
                    tone={row.debit === 0 ? "muted" : undefined}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money
                    value={row.credit}
                    tone={row.credit === 0 ? "muted" : undefined}
                  />
                </td>
              </tr>
            ))}
            <tr className="bg-zinc-50 font-semibold">
              <td className="px-3 py-2" colSpan={3}>
                Total
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={tb.totalDebit} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={tb.totalCredit} />
              </td>
            </tr>
          </DocTable>
        </>
      )}
    </div>
  );
}
