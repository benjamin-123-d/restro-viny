import { TabBar } from "@/components/purchasing/purchasing-ui";

const TABS = [
  { href: "/dashboard/stock", label: "Overview" },
  { href: "/dashboard/stock/warehouses", label: "Warehouses" },
  { href: "/dashboard/stock/bins", label: "Stock by warehouse" },
  { href: "/dashboard/stock/batches", label: "Batches" },
  { href: "/dashboard/stock/requests", label: "Requests" },
  { href: "/dashboard/stock/entries", label: "Entries" },
  { href: "/dashboard/stock/counts", label: "Counts" },
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
