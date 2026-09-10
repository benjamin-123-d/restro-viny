import { TabBar } from "@/components/purchasing/purchasing-ui";

/**
 * Purchasing shares one tab bar across the document chain, so an owner can walk
 * an order from quote to payment without going back to a menu each time.
 */
const TABS = [
  { href: "/dashboard/purchasing", label: "Overview" },
  { href: "/dashboard/purchasing/suppliers", label: "Suppliers" },
  { href: "/dashboard/purchasing/rfq", label: "RFQs" },
  { href: "/dashboard/purchasing/quotations", label: "Quotations" },
  { href: "/dashboard/purchasing/orders", label: "Orders" },
  { href: "/dashboard/purchasing/receipts", label: "Receipts" },
  { href: "/dashboard/purchasing/invoices", label: "Bills" },
  { href: "/dashboard/purchasing/payments", label: "Payments" },
] as const;

export default function PurchasingLayout({
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
