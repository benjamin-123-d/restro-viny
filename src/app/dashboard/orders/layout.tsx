import { TabBar } from "@/components/purchasing/purchasing-ui";

/**
 * Selling has two jobs that share nothing but the data: running the service
 * right now, and looking back at what was sold. One tab each.
 */
const TABS = [
  { href: "/dashboard/orders", label: "Service" },
  { href: "/dashboard/orders/factures", label: "Factures et tickets" },
] as const;

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <TabBar tabs={TABS} />
      {children}
    </div>
  );
}
