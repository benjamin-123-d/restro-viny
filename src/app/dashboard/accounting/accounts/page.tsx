import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { DocTable, Money } from "@/components/purchasing/purchasing-ui";
import { ROOT_TYPE_LABEL } from "@/lib/accounting";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listAccounts } from "@/services/accounting.service";

export default async function ChartOfAccountsPage() {
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

  const accounts = await listAccounts(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Chart of accounts"
        description="Every account the books can post to. Group accounts total their children and take no postings of their own."
      />
      <DocTable
        headers={[
          { label: "Code" },
          { label: "Account" },
          { label: "Type" },
          { label: "Kind" },
          { label: "Debit", align: "right" },
          { label: "Credit", align: "right" },
          { label: "Balance", align: "right" },
        ]}
      >
        {accounts.map((account) => (
          <tr key={account.id} className="border-b last:border-0">
            <td className="px-3 py-2 font-mono text-xs text-zinc-500">
              {account.code}
            </td>
            <td className="px-3 py-2">
              <span
                className={
                  account.isGroup
                    ? "font-semibold text-zinc-900"
                    : "pl-4 text-zinc-800"
                }
              >
                {account.name}
              </span>
              {account.isFrozen && (
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                  frozen
                </span>
              )}
            </td>
            <td className="px-3 py-2 text-zinc-600">
              {ROOT_TYPE_LABEL[account.rootType]}
            </td>
            <td className="px-3 py-2 text-xs text-zinc-500">
              {account.isGroup ? "Group" : account.accountType.replace(/_/g, " ").toLowerCase()}
            </td>
            <td className="px-3 py-2 text-right">
              <Money value={account.debit} tone={account.debit === 0 ? "muted" : undefined} />
            </td>
            <td className="px-3 py-2 text-right">
              <Money value={account.credit} tone={account.credit === 0 ? "muted" : undefined} />
            </td>
            <td className="px-3 py-2 text-right font-medium">
              <Money value={account.balance} tone={account.balance < 0 ? "danger" : undefined} />
            </td>
          </tr>
        ))}
      </DocTable>
      {accounts.length === 0 && (
        <EmptyState title="No accounts" description="The starter chart could not be created." />
      )}
    </div>
  );
}
