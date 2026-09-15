import { TabBar } from "@/components/purchasing/purchasing-ui";

const TABS = [
  { href: "/dashboard/accounting", label: "Vue d'ensemble" },
  { href: "/dashboard/accounting/accounts", label: "Plan comptable" },
  { href: "/dashboard/accounting/journals", label: "Écritures" },
  { href: "/dashboard/accounting/trial-balance", label: "Solde" },
  { href: "/dashboard/accounting/profit-and-loss", label: "Compte de résultat" },
  { href: "/dashboard/accounting/balance-sheet", label: "Bilan" },
  { href: "/dashboard/accounting/ledger", label: "Grand livre" },
] as const;

export default function AccountingLayout({
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
