import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocTable,
  Money,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listSupplierGroups, listSuppliers } from "@/services/supplier.service";

import { HelpBox } from "@/components/forms/help-box";
import { DocActions, NewButton } from "@/components/forms/doc-actions";
export default async function SuppliersPage() {
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

  const [suppliers, groups] = await Promise.all([
    listSuppliers(ctx, { includeDisabled: true }),
    listSupplierGroups(ctx),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Suppliers"
        description="Who you buy from, what you owe them, and how much is late."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton
          href="/dashboard/purchasing/suppliers/new"
          label="Nouveau fournisseur"
        />
      </div>
      <HelpBox
        defaultOpen={false}
        title="Aide — Fournisseurs"
        intro="La liste de ceux à qui vous achetez, avec ce que vous leur devez."
        steps={[
          "« + Nouveau fournisseur » en haut à droite pour en ajouter un.",
          "« Outstanding » = ce que vous leur devez encore ; « Overdue » en rouge = déjà en retard.",
          "« Open POs » = commandes passées pas encore terminées.",
        ]}
        tips={[]}
      />

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <span
              key={group.id}
              className="rounded-full border bg-white px-3 py-1 text-xs text-zinc-600"
            >
              {group.name}
              <span className="ml-1.5 font-medium text-zinc-900">
                {group.supplierCount}
              </span>
              {group.defaultPaymentTermsDays !== null && (
                <span className="ml-1.5 text-zinc-400">
                  · {group.defaultPaymentTermsDays}d terms
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          description="Add the vendors you buy from to start raising purchase orders."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Code" },
            { label: "Supplier" },
            { label: "Group" },
            { label: "Phone" },
            { label: "Terms" },
            { label: "Last order" },
            { label: "Open POs", align: "right" },
            { label: "Outstanding", align: "right" },
            { label: "Overdue", align: "right" },
          ]}
        >
          {suppliers.map((supplier) => (
            <tr key={supplier.id} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                {supplier.code}
              </td>
              <td className="px-3 py-2">
                <span className="font-medium text-zinc-900">
                  {supplier.name}
                </span>
                {supplier.isBlocked && (
                  <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                    on hold
                  </span>
                )}
                {supplier.disabled && (
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    disabled
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {supplier.supplierGroupName ?? "—"}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {supplier.phone ?? "—"}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {supplier.paymentTermsDays !== null
                  ? `${supplier.paymentTermsDays}d`
                  : "—"}
              </td>
              <td className="px-3 py-2">
                <DocDate iso={supplier.lastOrderDate} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {supplier.openOrderCount}
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={supplier.outstandingAmount}
                  tone={supplier.outstandingAmount === 0 ? "muted" : undefined}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <Money
                  value={supplier.overdueAmount}
                  tone={supplier.overdueAmount > 0 ? "danger" : "muted"}
                />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
