import { TabBar } from "@/components/purchasing/purchasing-ui";

const TABS = [
  { href: "/dashboard/selling", label: "Overview" },
  { href: "/dashboard/selling/customers", label: "Customers" },
  { href: "/dashboard/selling/quotations", label: "Quotations" },
  { href: "/dashboard/selling/orders", label: "Sales orders" },
  { href: "/dashboard/selling/deliveries", label: "Deliveries" },
  { href: "/dashboard/selling/invoices", label: "Invoices" },
  { href: "/dashboard/selling/payments", label: "Receipts" },
] as const;

export default function SellingLayout({
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
