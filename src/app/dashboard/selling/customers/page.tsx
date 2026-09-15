import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { DocTable, Money } from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listCustomers } from "@/services/customer.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
export default async function CustomersPage() {
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

  const rows = await listCustomers(ctx, { includeDisabled: true });

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Clients"
        description="Vos clients en compte, ce qu'ils doivent et le crédit qu'il leur reste."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/selling/customers/new"
          label="Nouveau client"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Clients"
        intro=""
        steps={[
          "« + Nouveau client » pour créer un client en compte.",
          "« Credit left » = ce qu'il peut encore vous devoir avant d'être bloqué.",
          "Un badge « over limit » rouge signale un client qui a dépassé sa limite.",
        ]}
        tips={[]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucun client"
          description="Ajoutez les clients que vous facturez pour saisir des commandes."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Code" },
            { label: "Client" },
            { label: "Groupe" },
            { label: "Téléphone" },
            { label: "Commandes ouvertes", align: "right" },
            { label: "Reste dû", align: "right" },
            { label: "Crédit restant", align: "right" },
            { label: "En retard", align: "right" },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                {row.code}
              </td>
              <td className="px-3 py-2">
                <span className="font-medium text-zinc-900">{row.name}</span>
                {row.overCreditLimit && (
                  <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                    over limit
                  </span>
                )}
                {row.disabled && (
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    disabled
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {row.customerGroupName ?? "—"}
              </td>
              <td className="px-3 py-2 text-zinc-600">{row.phone ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.openOrderCount}
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={row.outstandingAmount}
                  tone={row.outstandingAmount === 0 ? "muted" : undefined}
                />
              </td>
              <td className="px-3 py-2 text-right">
                {row.creditAvailable === null ? (
                  <span className="text-zinc-400">no limit</span>
                ) : (
                  <Money
                    value={row.creditAvailable}
                    tone={row.creditAvailable < 0 ? "danger" : undefined}
                  />
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={row.overdueAmount}
                  tone={row.overdueAmount > 0 ? "danger" : "muted"}
                />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
