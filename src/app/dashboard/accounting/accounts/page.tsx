import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { DocTable, Money } from "@/components/purchasing/purchasing-ui";
import { ROOT_TYPE_LABEL } from "@/lib/accounting";

const ACCOUNT_TYPE_LABEL: Readonly<Record<string, string>> = {
  BANK: "banque",
  CASH: "caisse",
  RECEIVABLE: "créances clients",
  PAYABLE: "dettes fournisseurs",
  STOCK: "stock",
  FIXED_ASSET: "immobilisation",
  TAX: "taxes",
  COST_OF_GOODS_SOLD: "achats consommés",
  DEPRECIATION: "amortissement",
  EQUITY: "capitaux propres",
  INCOME_ACCOUNT: "produit",
  EXPENSE_ACCOUNT: "charge",
  ROUND_OFF: "arrondi",
  OTHER: "autre",
};
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listAccounts } from "@/services/accounting.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
export default async function ChartOfAccountsPage() {
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

  const accounts = await listAccounts(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Plan comptable"
        description="Tous les comptes mouvementables. Les comptes de regroupement totalisent leurs sous-comptes sans écriture propre."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/accounting/accounts/new"
          label="Nouveau compte"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Plan comptable"
        intro=""
        steps={[
          "Les lignes en gras sont des regroupements : ils totalisent les comptes en dessous.",
          "« Balance » = solde du compte, du bon côté (positif = normal).",
          "Ajoutez un compte seulement s'il vous manque (ex. une seconde banque).",
        ]}
        tips={[]}
      />
      <DocTable
        headers={[
          { label: "Code" },
          { label: "Compte" },
          { label: "Type" },
          { label: "Nature" },
          { label: "Débit", align: "right" },
          { label: "Crédit", align: "right" },
          { label: "Solde", align: "right" },
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
              {account.isGroup
                ? "Regroupement"
                : (ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType)}
            </td>
            <td className="px-3 py-2 text-right">
              <Money
                value={account.debit}
                tone={account.debit === 0 ? "muted" : undefined}
              />
            </td>
            <td className="px-3 py-2 text-right">
              <Money
                value={account.credit}
                tone={account.credit === 0 ? "muted" : undefined}
              />
            </td>
            <td className="px-3 py-2 text-right font-medium">
              <Money
                value={account.balance}
                tone={account.balance < 0 ? "danger" : undefined}
              />
            </td>
          </tr>
        ))}
      </DocTable>
      {accounts.length === 0 && (
        <EmptyState
          title="Aucun compte"
          description="Le plan comptable de départ n'a pas pu être créé."
        />
      )}
    </div>
  );
}
