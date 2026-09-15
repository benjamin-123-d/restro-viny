import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/format";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getLowStockCount } from "@/services/stock.service";
import {
  listBatches,
  listMaterialRequests,
  listStockEntries,
  listWarehouses,
} from "@/services/stock-advanced.service";

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "warn";
}) => (
  <div className="rounded-lg border bg-white p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
      {label}
    </p>
    <p
      className={`mt-1 text-2xl font-semibold ${
        tone === "danger"
          ? "text-red-600"
          : tone === "warn"
            ? "text-amber-700"
            : "text-zinc-900"
      }`}
    >
      {value}
    </p>
  </div>
);

const OPEN_REQUEST = [
  "PENDING",
  "PARTIALLY_ORDERED",
  "ORDERED",
  "PARTIALLY_RECEIVED",
];

export default async function StockPage() {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <PageHeader
          title="Stock"
          description="Entrepôts, lots, demandes, mouvements et comptages."
        />
        <EmptyState
          title="Aucun restaurant"
          description="Demandez à un administrateur de créer votre restaurant pour configurer le stock."
        />
      </div>
    );
  }

  const [warehouses, batches, requests, entries, lowStock] = await Promise.all([
    listWarehouses(ctx, { includeDisabled: true }),
    listBatches(ctx, { expiringWithinDays: 14 }),
    listMaterialRequests(ctx),
    listStockEntries(ctx),
    getLowStockCount(ctx.restaurantId),
  ]);

  const stockValue = warehouses.reduce((s, w) => s + w.stockValue, 0);
  const expired = batches.filter((b) => b.isExpired).length;
  const openRequests = requests.filter((r) =>
    OPEN_REQUEST.includes(r.status),
  ).length;
  const draftEntries = entries.filter((e) => e.status === "DRAFT").length;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Stock"
        description="Entrepôts et emplacements, lots et dates limites, demandes d'articles, mouvements et comptages."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entrepôts" value={String(warehouses.length)} />
        <Stat label="Valeur du stock" value={formatCurrency(stockValue)} />
        <Stat
          label="Stock bas"
          value={String(lowStock)}
          tone={lowStock > 0 ? "warn" : undefined}
        />
        <Stat
          label="Lots périmés"
          value={String(expired)}
          tone={expired > 0 ? "danger" : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label="Expirent sous 14 jours"
          value={String(batches.length - expired)}
          tone={batches.length - expired > 0 ? "warn" : undefined}
        />
        <Stat label="Demandes en cours" value={String(openRequests)} />
        <Stat label="Mouvements en brouillon" value={String(draftEntries)} />
      </div>

      {warehouses.length === 0 && (
        <EmptyState
          title="Aucun entrepôt"
          description="Créez un entrepôt pour suivre le stock par emplacement."
        />
      )}
    </div>
  );
}
