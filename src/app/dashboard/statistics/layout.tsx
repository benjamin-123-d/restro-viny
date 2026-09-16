import { TabBar } from "@/components/purchasing/purchasing-ui";

/**
 * One module for every figure: what was sold, what was bought, and what is
 * left between the two. The overview stays first, as the page that answers
 * « comment ça va ? » before the detail.
 */
const TABS = [
  { href: "/dashboard/statistics", label: "Vue d'ensemble" },
  { href: "/dashboard/statistics/ventes", label: "Ventes" },
  { href: "/dashboard/statistics/achats", label: "Achats" },
  { href: "/dashboard/statistics/benefices", label: "Bénéfices" },
] as const;

export default function StatisticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <TabBar tabs={TABS} />
      {children}
    </div>
  );
}
