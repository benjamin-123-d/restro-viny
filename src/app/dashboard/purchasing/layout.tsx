import { TabBar } from "@/components/purchasing/purchasing-ui";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getPurchasingMode } from "@/services/direct-purchase.service";

/**
 * Purchasing shares one tab bar across the document chain, so an owner can walk
 * an order from quote to payment without going back to a menu each time. In
 * direct mode the chain folds behind a single tab — nothing is taken away, the
 * short way is simply put first.
 */
const CHAIN = [
  { href: "/dashboard/purchasing/quotations", label: "Devis" },
  { href: "/dashboard/purchasing/orders", label: "Commandes" },
  { href: "/dashboard/purchasing/receipts", label: "Réceptions" },
];

export default async function PurchasingLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getManagerContextOrNull();
  const mode = ctx ? await getPurchasingMode(ctx) : "FULL";

  const tabs = [
    { href: "/dashboard/purchasing", label: "Vue d'ensemble" },
    { href: "/dashboard/purchasing/direct", label: "Achats directs" },
    { href: "/dashboard/purchasing/suppliers", label: "Fournisseurs" },
    ...(mode === "DIRECT" ? [{ href: "/dashboard/purchasing/quotations", label: "Chaîne complète" }] : CHAIN),
    { href: "/dashboard/purchasing/invoices", label: "Factures" },
    { href: "/dashboard/purchasing/payments", label: "Paiements" },
  ];

  return (
    <div className="flex flex-col">
      <TabBar tabs={tabs} />
      {children}
    </div>
  );
}
