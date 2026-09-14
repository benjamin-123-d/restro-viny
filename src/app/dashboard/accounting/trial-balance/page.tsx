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
          title="No restaurant yet"
          description="Ask an admin to onboard your restaurant."
        />
      </div>
    );
  }

  const tb = await getTrialBalance(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Trial balance"
        description="Every account that moved, and proof the two columns agree."
      />
      {tb.rows.length === 0 ? (
        <EmptyState
          title="Nothing posted yet"
          description="The trial balance fills in as soon as a journal is posted."
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
              ? "Debits and credits agree."
              : "Out of balance \u2014 the ledger does not tie."}
          </p>
          <DocTable
            headers={[
              { label: "Code" },
              { label: "Account" },
              { label: "Type" },
              { label: "Debit", align: "right" },
              { label: "Credit", align: "right" },
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
