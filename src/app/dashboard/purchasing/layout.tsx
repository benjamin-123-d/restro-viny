import { TabBar } from "@/components/purchasing/purchasing-ui";

/**
 * Purchasing shares one tab bar across the document chain, so an owner can walk
 * an order from quote to payment without going back to a menu each time.
 */
const TABS = [
  { href: "/dashboard/purchasing", label: "Vue d'ensemble" },
  { href: "/dashboard/purchasing/suppliers", label: "Fournisseurs" },
  { href: "/dashboard/purchasing/quotations", label: "Devis" },
  { href: "/dashboard/purchasing/orders", label: "Commandes" },
  { href: "/dashboard/purchasing/receipts", label: "Réceptions" },
  { href: "/dashboard/purchasing/invoices", label: "Factures" },
  { href: "/dashboard/purchasing/payments", label: "Paiements" },
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
