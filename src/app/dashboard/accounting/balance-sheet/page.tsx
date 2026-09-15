import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DocTable, Money } from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getBalanceSheet } from "@/services/accounting.service";

export default async function BalanceSheetPage() {
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

  const sheet = await getBalanceSheet(ctx);
  const empty =
    sheet.assets.length === 0 &&
    sheet.liabilities.length === 0 &&
    sheet.equity.length === 0;

  const section = (title: string, rows: typeof sheet.assets, total: number) => (
    <>
      <tr className="bg-zinc-50">
        <td
          className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
          colSpan={3}
        >
          {title}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.accountId} className="border-b last:border-0">
          <td className="px-3 py-2 font-mono text-xs text-zinc-500">
            {row.code}
          </td>
          <td className="px-3 py-2 text-zinc-800">{row.name}</td>
          <td className="px-3 py-2 text-right">
            <Money value={row.balance} />
          </td>
        </tr>
      ))}
      <tr className="border-b font-medium">
        <td className="px-3 py-2" colSpan={2}>
          Total {title.toLowerCase()}
        </td>
        <td className="px-3 py-2 text-right">
          <Money value={total} />
        </td>
      </tr>
    </>
  );

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Bilan"
        description="Ce que l'entreprise possède face à ce qu'elle doit. Le résultat de la période reste hors capitaux propres jusqu'à l'écriture de clôture."
      />
      {empty ? (
        <EmptyState
          title="Rien de comptabilisé"
          description="Le bilan se remplit dès que des écritures sont comptabilisées."
        />
      ) : (
        <>
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              sheet.isBalanced
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-700"
            }`}
          >
            {sheet.isBalanced
              ? "L'actif est égal au passif, plus les capitaux propres et le résultat de la période."
              : "Le bilan n'est pas équilibré."}
          </p>
          <DocTable
            headers={[
              { label: "Code" },
              { label: "Compte" },
              { label: "Solde", align: "right" },
            ]}
          >
            {section("Actif", sheet.assets, sheet.totalAssets)}
            {section("Passif", sheet.liabilities, sheet.totalLiabilities)}
            {section("Capitaux propres", sheet.equity, sheet.totalEquity)}
            <tr className="border-b">
              <td className="px-3 py-2 text-zinc-800" colSpan={2}>
                Résultat de la période
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={sheet.retainedProfit}
                  tone={sheet.retainedProfit < 0 ? "danger" : undefined}
                />
              </td>
            </tr>
            <tr className="bg-zinc-50 font-semibold">
              <td className="px-3 py-2" colSpan={2}>
                Passif + capitaux propres + résultat
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={
                    sheet.totalLiabilities +
                    sheet.totalEquity +
                    sheet.retainedProfit
                  }
                />
              </td>
            </tr>
          </DocTable>
        </>
      )}
    </div>
  );
}
