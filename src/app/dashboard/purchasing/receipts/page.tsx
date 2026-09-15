import { NewButton } from "@/components/forms/doc-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  DocDate,
  DocNumber,
  DocTable,
  Money,
  Progress,
  StatusBadge,
} from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { listPurchaseReceipts } from "@/services/purchase-receipt.service";

export default async function PurchaseReceiptsPage() {
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

  const receipts = await listPurchaseReceipts(ctx);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Réceptions de marchandises"
        description="Les livraisons reçues. C'est la validation d'une réception qui fait entrer la marchandise en stock."
      />
      <div className="-mt-2 flex justify-end">
        <NewButton href="/dashboard/purchasing/receipts/new" label="Nouvelle réception" />
      </div>
      {receipts.length === 0 ? (
        <EmptyState
          title="Rien de reçu pour l'instant"
          description="Enregistrez la livraison d'une commande d'achat pour l'entrer en stock."
        />
      ) : (
        <DocTable
          headers={[
            { label: "Numéro" },
            { label: "Fournisseur" },
            { label: "Date" },
            { label: "Statut" },
            { label: "Facturé" },
            { label: "Total", align: "right" },
          ]}
        >
          {receipts.map((receipt) => (
            <tr key={receipt.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <DocNumber number={receipt.number} />
                {receipt.isReturn && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                    return
                  </span>
                )}
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {receipt.supplierName}
              </td>
              <td className="px-3 py-2">
                <DocDate iso={receipt.postingDate} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={receipt.status} />
              </td>
              <td className="px-3 py-2">
                <Progress percent={receipt.billedPercent} />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={receipt.grandTotal} />
              </td>
            </tr>
          ))}
        </DocTable>
      )}
    </div>
  );
}
