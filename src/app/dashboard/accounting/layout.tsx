import { TabBar } from "@/components/purchasing/purchasing-ui";

const TABS = [
  { href: "/dashboard/accounting", label: "Overview" },
  { href: "/dashboard/accounting/accounts", label: "Chart of accounts" },
  { href: "/dashboard/accounting/journals", label: "Journals" },
  { href: "/dashboard/accounting/trial-balance", label: "Trial balance" },
  { href: "/dashboard/accounting/profit-and-loss", label: "Profit & loss" },
  { href: "/dashboard/accounting/balance-sheet", label: "Balance sheet" },
  { href: "/dashboard/accounting/ledger", label: "General ledger" },
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
