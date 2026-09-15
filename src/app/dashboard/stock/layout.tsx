import { TabBar } from "@/components/purchasing/purchasing-ui";

const TABS = [
  { href: "/dashboard/stock", label: "Vue d'ensemble" },
  { href: "/dashboard/stock/warehouses", label: "Entrepôts" },
  { href: "/dashboard/stock/bins", label: "Stock par entrepôt" },
  { href: "/dashboard/stock/batches", label: "Lots" },
  { href: "/dashboard/stock/requests", label: "Demandes" },
  { href: "/dashboard/stock/entries", label: "Mouvements" },
  { href: "/dashboard/stock/counts", label: "Comptages" },
] as const;

export default function StockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <TabBar tabs={TABS} />
      {children}
    </div>
  );
}
