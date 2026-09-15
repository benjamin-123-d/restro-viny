import { TabBar } from "@/components/purchasing/purchasing-ui";

const TABS = [
  { href: "/dashboard/selling", label: "Vue d'ensemble" },
  { href: "/dashboard/selling/customers", label: "Clients" },
  { href: "/dashboard/selling/quotations", label: "Devis" },
  { href: "/dashboard/selling/orders", label: "Commandes clients" },
  { href: "/dashboard/selling/deliveries", label: "Livraisons" },
  { href: "/dashboard/selling/invoices", label: "Factures" },
  { href: "/dashboard/selling/payments", label: "Encaissements" },
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
