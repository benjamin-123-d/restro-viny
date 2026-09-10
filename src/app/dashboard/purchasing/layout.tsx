import Link from "next/link";

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
      <nav className="overflow-x-auto border-b bg-white">
        <ul className="flex min-w-max gap-1 px-4 py-2 lg:px-6">
          {TABS.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className="block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
